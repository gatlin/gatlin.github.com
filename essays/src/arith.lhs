---
title: Parsing arithmetic expressions with streams
lead: Or, [insert a Ghostbuster's joke]
...

A common problem many of you probably have is not having enough tools at your
disposal, *right now*, with which to perform arithmetic.

"Yes! He gets me!" you cry out, alone but hopeful.

In this essay I will write one and show you how it works. Some topics I'll be
discussing:

- Stack machines
- Stream processing
- Wine

We will be building this in Haskell, and this post is literate haskell which
you can run in ghci by grabbing the source.

Prelude
===

This being Haskell, useful programs have like a billion imports and what-nots.

> {-# LANGUAGE RankNTypes #-}
>
> import Prelude hiding ( drop
>                       , take
>                       , takeWhile
>                       , print
>                       , map
>                       , filter
>                       , foldl
>                       , foldl'
>                       , foldr
>                       , foldr'
>                       , iterate
>                       )
> import FreeStream
> import System.IO (isEOF)
> import Control.Monad.Trans.Free
> import Data.Maybe (fromJust)

You can get [FreeStream here][freestream].

Polish stacks
===

Nerds who do a lot of serial arithmetic - finance types, land appraisers,
business goons - swear by what is called [reverse Polish notation][rpn]. When
using a calculator to evaluate some complicated arithmetic, instead of writing
this:

    ((2 + 3) * 4 ) + 5

They write this:

    2 3 + 4 * 5 +

This is a convenient way to rattle through some ongoing calculation without
needing to type parentheses and make sure everything is grouped correctly.

**Our goal**: to write a reverse Polish notation calculator program.

You can think of the calculation as a *stack*. You receive a piece of the
expression and if that piece is a number, you push it on the stack. If it is
not a number but an operation, you remove everything from the stack, apply the
operation, and put the result back on the stack.

For those of you who like horrible diagrams, the following may be helpful:

    A. _ : 2, 3, +, 4, *, 5, +  (initial)

    B. 2 : 3, +, 4, *, 5, +     (push 2)

       3 : +, 4, *, 5, +        (push 3)
    C. 2

    D. 5 : 4, *, 5, +           (pop 3, pop 2, add them, push 5)

       4 : *, 5, +              (push 4)
    E. 5

    F. 20 : 5, +                (pop 4, pop 5, multiply them, push 20)

        5
    G. 20 : +                   (push 5)

    H. 25                       (pop 5, pop 25, add them, push 25)

At each step you either **push** an item on the stack, or **pop** an item off
the stack. Reverse Polish notation is really just a way to describe what to do
to a stack.

What does arithmetic look like?
===

To parse arithmetic expressions, we will need some model of arithmetic which we
can manipulate in our program. In our case, we will support addition,
multiplication, subtraction, and division. These each take two numbers as
operands.

> data Arithmetic
>     = Value Int
>     | Add Arithmetic Arithmetic
>     | Mul Arithmetic Arithmetic
>     | Sub Arithmetic Arithmetic
>     | Div Arithmetic Arithmetic
>     deriving Show

An `Arithmetic` value is either an integer value, or any of four binary
operations.

So our example of `2 3 + 4 * 5 +` might look something like this:

> exp1 = (Add
>          (Mul
>            (Add (Value 2)
>                 (Value 3))
>            4)
>          5)

But how should we get a result out of that? Put another way, we must figure out
how to write a function with this signature:

> doArith :: Arithmetic -> Int

If our expression is just a `Value`, pull out the number and be done:

> doArith (Value v) = v

Otherwise, we are going to have some operation and then two `Arithmetic`
values, which we should evaluate:

> doArith (Add l r) = (doArith l) + (doArith r)
> doArith (Mul l r) = (doArith l) * (doArith r)
> doArith (Sub l r) = (doArith l) - (doArith r)
> doArith (Div l r) = (doArith l) `div` (doArith r)

This makes sense: either the expression has an immediate value, or it is some
operation applied to two sub-expressions.

Now we have a model representation of arithmetic problems and a way to evaluate
them. But how do we create these models from strings like `2 3 + 4 * 5 +`?

"Sweet streams are made of these"
===

Say you're writing a program to process video files in some way. A professional
raw video file might be several gigabytes in size. If you're adding a color
filter or something which only needs to see one frame at a time, you don't need
to compute every frame ahead of time. Instead, grab a small bundle of frames at
a time, do stuff to them, and then grab another bundle on demand.

This is called *stream processing*: you have a routine which calculates the
next value in a sequence on demand, and other routines which transform and
consume these values.

In our case, we assume we have a stream of strings and we want to construct
`Arithmetic` values from them.

Shameless Interlude, and also some concepts
===

I wrote a little stream processing library called `FreeStream` because stream
processing is very interesting to me and I want to understand it and its
implications fully.

FreeStream has the concept of Generators, Sinks, and Processes.

A *generator* is a function which computes a value and yields it each time it
is called. Unlike a "normal" function which returns a value and is gone, a
generator has some internal state.

A *sink* is a function which waits for incoming values and processes them until
the stream is empty or until it is finished, and returns a final value.

A *process* is a function which both yields values like a generator and awaits
values like a sink.

Stream processors must sit on top of a monad, like `IO` or `Maybe` or `State`
or whatever. The way I have constructed them, they allow you to pipeline
*effectful*, *impure* monadic computations.

Parsing a stream into a stack
===

So, we want to parse streams of string tokens into an `Arithmetic` value. The
signature for this function, using FreeStream, is this:

> parseArith :: Sink (Stream String) IO (Maybe Arithmetic)

This says the sink accepts a stream of `String` values, sits on top of the `IO`
monad, and `Maybe` it will have an `Arithmetic` value. After all, if the
expression is malformed you can't promise a meaningful result.

We are going to model a stack using Haskell lists: "pushing" is adding
something to the front and "popping" is taking an item off the front. We are
going to loop until the input is exhausted and we are going to need an empty
stack, so let's get going:

> parseArith = loop [] where

So far so good! But what is this enigmatic `loop` function? It's this:

>     loop stack = do
>         d <- await
>         case recv d of
>             Just token -> case token of
>                 "+" -> buildBranch (Add) stack
>                 "*" -> buildBranch (Mul) stack
>                 "-" -> buildBranch (Sub) stack
>                 "/" -> buildBranch (Div) stack
>
>                 _   -> do
>                     v <- return token
>                     loop $ (Value (read v)):stack
>             Nothing -> return . Just . head $ stack

`loop` is a function which, given an initial stack, awaits a stream value and
receives its data. If the value is `Just` something, then we will continue with
our processing. If it is `Nothing`, though, we pop an item off the stack and
return it (because there will only be one).

The token is just a string being carried along the stream. If the token is any
one of our 4 operations, we will call a soon-to-be-defined `buildBranch`
function with the correct operation and the current contents of the stack, and
return whatever it does. If the token is anything else, it is presumed to be a
number, and a `Value` is pushed on the stack (and then `loop` is called with
this new stack).

`buildBranch` looks like this:

>    buildBranch con stack = do
>        if length stack < 2
>            then return Nothing
>            else do
>                (r:l:rest) <- return stack
>                r          <- return $ con l r
>                loop $ r:rest

`con` refers to the "constructor" we are using for our `Arithmetic` value.
Basically, if the stack doesn't have two elements then there has been some
mistake and we return Nothing. Otherwise, we break the left (`l`) and right
(`r`) items off, build the appropriate `Arithmetic` value, push it on the
stack, and `loop` with our new stack.

But how do we generate these tokens?

A token joke (?)
===

FreeStream lets you convert a list into a stream like so:

    stream (each [1..10]) |> someSink

`each` takes a list of `X` values and creates a `Generator X`, and `stream`
takes a `Generator X` and creates a `Generator (Stream X)`.

The `|>` hooks a `Generator (Stream X)` to a `Sink (Stream X)`, and produces
some result.

So we can convert the string "2 3 + 4 * 5 +" into a stream of `Char` values
like so:

    stream (each "2 3 + 4 * 5 +") |> someSink

But we want a stream of `String` values, not `Char` values. It is easy to
convert a `Char` into a `String` (just make it a singleton list, ie `'c' ->
['c'] == "c"`) and it is easy to ignore spaces. But what if a number is two
digits? What if we have a lot of unnecessary spaces?

Since we are going to have to transform the stream anyway, this is a
good opportunity to also make sure that we ignore the correct characters and
don't split apart the wrong ones.

Enter `tokenize`:

> tokenize :: Process (Stream Char) (Stream String) IO ()
> tokenize = loop "" where
>     loop acc = do
>         d <- await
>         case recv d of
>             Nothing -> flush acc >> return ()
>             Just c -> case c of
>                 ' ' -> do
>                     flush acc
>                     loop ""
>                 _   -> loop $ acc ++ [c]
>
>     flush acc = case acc of
>         "" -> return ()
>         " " -> return ()
>         _ -> send acc
>
>     send = yield . message

Following the other sink pattern from before, we are going to loop over the
stream values, collecting them into a buffer, and yield that buffer whenever we
encounter a space.

We get the value by calling `await`, and then `recv` it. If it is `Nothing`,
the stream has ended so we should flush our buffer and return.

If there is a character, we have two options:

1. It is a space, in which case we should yield our buffer and start over; or
2. Add the character to our buffer and iterate.

We must exercise discretion when flushing, too: if the buffer consists of a
space already, or an empty string, let's just ignore it. If, however, there is
meaningful content, let's send our value down the stream.

Victory!
===

FreeStream allows you to join generators and processes using the `+>` operator.
So, our pipeline of breaking apart a string into characters, streaming them,
tokenizing them to produce a new stream of strings, and aggregating them into a
builder of `Arithmetic` values looks a little something like this:

> rpn :: String -> IO (Maybe Int)
> rpn str = do
>     parsed <- stream (each str) +> tokenize |> parseArith
>     case parsed of
>         Nothing -> return Nothing
>         Just  p -> return . Just $ doArith p

If the stream parsing step works, we feed the `Arithmetic` value to our
evaluation function and return the result.

Conclusion and Future Investigation
===

There are actual production-ready, beautifully engineered libraries out there
for this, my favorite being [pipes][pipes]. However, I wanted to not only show
how stream processing can be used for useful tasks, but also (if you look at
the [FreeStream][freestream] source code) that these stream processing
utilities themselves are not difficult conceptually or practically.

In the future, I would like to add some concurrency primitives so that a value
might be mapped concurrently to a number of processes or sinks, and the results
combined together. It seems like only a small step from implementing something
like [this][orc] for creating really powerful and simple distributed systems.

But for now, we can play with our calculator in ghci:

    ghci> rpn "2 3 + 4 * 5 +"
    Just 25

[rpn]: http://en.wikipedia.org/wiki/Reverse_Polish_notation
[freestream]: https://github.com/gatlin/FreeStream
[pipes]: https://hackage.haskell.org/package/pipes
[orc]: http://orc.csres.utexas.edu/
