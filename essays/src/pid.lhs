---
title: PID controller in Haskell
lead: Or, when will the screaming stop? When?
...

A major project I want to embark on at some point in the future is making a
quadrotor. I've made one before but I was at the mercy of a lot of off-the-shelf
software that I'm not altogether sure was entirely correct, either.

So I want to eventually program a quadrotor (or similarly awesome robot thing)
and I would really enjoy doing it in Haskell. It has a low footprint and is
already used in other real time settings.

A baby step on this journey, for me, is to understand how [PID controllers][pid]
work. To that end I'm going to try and write a PID controller in Haskell.

This post is actually written in literate Haskell, so you can download the
source [here][src] and compile it as-is. You'll need to ensure you have
installed the latest `tubes` package (`cabal install tubes` should suffice).

PID controller theory
===

The *error* is the difference between my measured value and my desired
value. PID controllers try to minimize this error by emitting a correction
value. The error value makes three considerations:

- The correction should be in **p**roportion to the size of the error. You want
  to make small corrections for small errors, and large corrections for large
  errors.

- The correction should take into account the **i**ntegral of past errors; in
  other words, their sum. If the controller is working, then output values will
  become negative (or positive) to get the sum down to 0.

- The correction should consider the **d**erivative of the error function. In
  other words, it should look at the difference between the last error and the
  current one to forecast if the situation is getting better or worse.

Hence, **PID**. Each of these three computed values is multiplied by a different
constant, called a *gain*, allowing PID controllers to be tuned to correct
behavior.

The function that governs a PID controller is this:

    u(t) = K[p] e(t) + K[i] (Integral 0 -> t of e(t)dt) + K[d] de(t)/dt

    where
        K[p] = Proportional gain
        K[i] = Integral gain
        K[d] = Derivative gain
        e(t) = Error function: desired value - measured value at time t

This almost reads like Haskell already.

Setup
===

I'm going to use my [tubes library][tubes] to generate fake output data and my
PID controller will be a `Tube` receiving these values and emitting corrections.

First, the modules and language extensions I'll be using:

> {-# LANGUAGE Arrows #-}
> import Tubes
> import Prelude hiding (map)
> import Control.Arrow

I hear you ask, "What's the arrow crap?" There are a lot of excellent resources
for arrows and I won't bother trying to retread. The simple answer is that an
*arrow* models a process that transforms some value *a* into a value *b*.

And again I hear you: "Isn't that what a function does?" Indeed. And actually
functions *are* arrows. But there are other kinds. Arrows can, for instance,
perform multiple computations *simultaneously*, built by combining other
`Arrows`.

The `Arrow` class is exported by `Control.Arrow`. GHC's `Arrows` language
extension allows us to write complex arrow functions in a notation that looks an
awful lot like a wiring diagram.

The `Channel` type from `tubes` is a variety of `Tube` that isn't a `Source` or
a `Sink`: in other words, it receives upstream values, does something, and
forwards results downstream. It also happens to be an `Arrow`.

Let's write some actual fucking code
===

In a discrete system like this the integral is more or less just the sum of all
previous values. Let's write an integration `Channel` that keeps track of this
state internally:

> integral :: (Fractional a, Monad m) => Channel m a a
> integral = Channel $ loop 0 where
>     loop sumErr = do
>         err <- await
>         let result = 0.5*(sumErr + err)
>         yield result
>         loop result

With a starting sum of 0 this is very self-explanatory: a new error value comes
from upstream, it is added to the running total, the total is yielded
downstream, repeat.

And now for the derivative:

> deriv :: (Fractional a, Monad m) => Channel m a a
> deriv = Channel $ loop 0 where
>     loop lastErr = do
>         err <- await
>         yield (err - lastErr)
>         loop err

Actually `deriv` is even simpler. The last error is subtracted from the current
error, and then the current error becomes the last error. Woah.

And now the point of our arrow
===

Equipped with integration and derivation and fancy `Arrow` notation we can write
our PID routine.

> pid :: (Fractional a, Monad m)
>     => a -- ^ proportional gain
>     => a -- ^ integral gain
>     => a -- ^ derivative gain
>     => a -- ^ desired value
>     => Channel m a a
>
> pid kp ki kd desired = proc measured -> do
>     let err = desired - measured
>     i <- integral -< err
>     d <- derivative -< err
>     returnA -< kp*err + ki*i + kd*d

To wit: the measured output comes in, the error is computed, the integral and
derivative are computed, and the correction value is computed straightforwardly
from the definition.

Let's test it out.

> main :: IO ()
> main = do
>     let outputs = [5, 7, 9, 14, 11, 9, 8, 12, 9]
>     let target_value = 10 -- why not?
>     runTube $ each outputs
>            >< tune (pid 0.5 0.1 0.2 target_value)
>            >< map show
>            >< pour display

The output from running this program[^1]:

    4.0
    1.9
    0.9999999999999999
    -2.5
    0.5000000000000001
    1.4
    1.9000000000000001
    -1.3
    1.7000000000000002

Not too shabby, honestly. While this could use some fine-tuning the correction
codes are more or less solid attempts to keep the output near 10.

My goal would be to write control software in Haskell using `tubes`, with
sensors emitting streams of values and control routines operating on them in
real time and constant memory usage.

Anyway I had fun and I hope you did too!

[pid]: http://en.wikipedia.org/PID_controller
[tubes]: https://github.org/gatlin/tubes
[src]: http://niltag.net/essays/src/pid.lhs

[^1]: The functions `tune` and `pour` correspond to the types `Channel` and
    `Sink`, respectively. Both are wrappers around a more fundamental `Tube`
    type, and after they have been constructed safely they can be unwrapped
    using those functions. `display` is a `Sink` that comes with the `tubes`
    package. 
