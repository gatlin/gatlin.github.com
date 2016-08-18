---
title: PID controller in Haskell
lead: Or, when will the screaming stop? When?
...

A major project I want to embark on at some point in the future is making a
quadrotor. I've made one before but I was at the mercy of a lot of off-the-shelf
software that I'm not altogether sure was entirely correct, either. So I want
to ultimately program my own flight control software.

A baby step on this journey, for me, is to understand how [PID controllers][pid]
work. To that end I'm going to try and write my very own PID controller, which
I'm sure my parents will want to post on the refrigerator and show their
friends.

This post is actually written in literate Haskell, so you can download the
source [here][src] and compile it as-is. You'll need to ensure you have
installed the latest `tubes` package (`cabal install tubes` should suffice).

PID controller theory
===

We are trying to control something - say, a rotor on a quadcoptor. We have a
measurement of how level we are along some axis, along with a desired value.

The *error* is the difference between my measured value and my desired
value. PID controllers try to minimize this error by emitting a correction
value.

The *error function* is very simple: `e(t) = desired_value - measured_value(t)`,
wehre `measured_value` is a function giving the measurement at any given time,
and `t` is time. This is a little pedantic but we'll use this in a moment.

The control algorithm makes three considerations:

- The correction should be in **p**roportion to the size of the error (small
  errors should beget small corrections, etc);

- The **i**ntegral of the error function from start to the current time which,
  informally, tracks the *amount* of error we have accumulated over the runtime
  of the controller; and

- The correction should consider the **d**erivative of the error function at
  the current time which gives a forecast about the general direction the
  function is heading.

Hence, **PID**. Each of these three computed values is multiplied by a different
constant, called a *gain*, allowing PID controllers to be tuned to correct
behavior. In our example we are measuring how level a rotor is but the thing we
are controlling is power sent to the motor. So we must have these configurable
gain values.

The function that governs a PID controller is this:

    u(t) = K[p] e(t) + K[i] (Integral 0 -> t of e(t)dt) + K[d] de(t)/dt

    where
        K[p] = Proportional gain
        K[i] = Integral gain
        K[d] = Derivative gain
        e(t) = Error function: desired value - measured value at time t

I can feel the excitement welling within you!

Setup and a little background
===

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
`Arrows`. You can use the functions in `Control.Arrow` to do this or you can be
lazy and have the `Arrows` language extension use them for you.

The `tubes` library defines a base `Tube` type, which is a computation that can
suspend itself to `await` upstream values or `yield` values downstream. A
`Channel` is a restricted, specialized variety of `Tube` that can do both. It
also happens to be an `Arrow`. The [tubes documentation][tubes] explains this
in greater detail.

Let's write some actual fucking code
===

First we will define a function computes a running integral. The integral term
allows us to take into account how much error we have accumulated over time.
If significant error persists for a while, the *I* term will change
proportionally to reflect that.

> integral :: (Fractional a, Monad m) => Channel m (a,a) a
> integral = Channel $ loop 0 where
>     loop sumErr = do
>         (dt, err) <- await
>         let result = sumErr + err*dt
>         yield result
>         loop result

The input is a pair of values. The first item in the pair is the number of
timesteps since our last sample. The second item is the actual measured value.

We will take into account the time difference because there are a number of
reasons why we might miss a few samples in a real time, complex system. Hence
we scale the error by the number of timesteps since the last reading to
approximate the integral.

And now for the derivative:

> deriv :: (Fractional a, Monad m) => Channel m (a,a) a
> deriv = Channel $ loop 0 where
>     loop lastErr = do
>         (dt, err) <- await
>         yield $ (err - lastErr) / dt
>         loop err

Again the input is a pair of the time since we last saw a value, and a new
actual value. The derivative of a function is basically a measurement of the
slope of the curve at a given point. Our algorithm is crude but will get the
job done: we subtract the last value from the current value and divide it by
the amount of time between the two.

And now the point of our arrow
===

Our fake readings will be a sequence of pairs: the first item in the pair will
be a number indicating a timestamp, and the second will be the actual value
read. Intuitively this is more or less the shape of the data I could expect
from a real system.

However, we needed the time *differences* for our intrepid integral and
derivative functions. So let's write a `Channel` that turns the timestamps into
time differentials:

> timeDiff :: (Fractional a, Monad m) => a -> Channel m (a, a) (a, a)
> timeDiff startTime = Channel $ loop startTime where
>     loop lastTime = do
>     (t, v) <- await
>     let dt = t - lastTime
>     yield (dt, v)
>     loop t

Finally, we can write out PID controller using the functions we've written and
the `Arrows` language extension:

> pid :: (Fractional a, Monad m)
>     => a -- ^ proportional gain
>     -> a -- ^ integral gain
>     -> a -- ^ derivative gain
>     -> a -- ^ desired value
>     -> Channel m (a, a) a
>
> pid kp ki kd desired = timeDiff 0 >>> proc pv -> do
>     let pv' = fmap (desired -) pv
>     i <- integral -< pv'
>     d <- deriv -< pv'
>     returnA -< kp*(snd pv') + ki*i + kd*d

The `pv` term means "process variable" and is a pair containing the time
differential and the measured value.

We use the `(>>>)` function from `Control.Arrow` to define `pid` as accepting
the output of `timeDiff`. The `Arrows` syntax further makes it very simple and
intuitive to feed a value through two concurrent `Channel`s and combine their
results at the end.

Let's test it out.

> main :: IO ()
> main = do
>     let readings = [(1, 5) , (3 , 7), (4 , 9), (7 , 14)
>                    ,(8, 11), (10, 9), (11, 8), (13,12), (15, 9)]
>     let target_value = 10 -- why not?
>     runTube $ each readings
>            >< tune (pid 0.6 0.1 0.15 target_value)
>            >< map show
>            >< pour display

The output from running this program[^1]:

    4.25
    2.75
    1.5000000000000002
    -2.65
    -0.25
    0.85
    1.65
    -1.6
    0.9249999999999999

Not too shabby, honestly. While this could use some fine-tuning the correction
values are more or less solid attempts to keep the output near 10.

My goal would be to write control software in Haskell using `tubes`, with
sensors emitting streams of values and control routines operating on them in
real time and constant memory usage.

Anyway I had fun and I hope you did too!

[pid]: http://en.wikipedia.org/PID_controller
[tubes]: http://hackage.haskell.org/package/tubes
[src]: http://niltag.net/essays/src/pid.lhs

[^1]: The functions `tune` and `pour` correspond to the types `Channel` and
    `Sink`, respectively. Both are wrappers around a more fundamental `Tube`
    type, and after they have been constructed safely they can be unwrapped
    using those functions. `display` is a `Sink` that comes with the `tubes`
    package. 
