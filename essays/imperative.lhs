How to add imperative programming to a pure functional language
===

Many people bemoan languages such as Haskell for not supporting imperative
programming; they decry the need for math in their computer science.

![Math? In my computer? Yeah right.](http://i.imgur.com/YDIaEPB.jpg)

I'm here to tell you that not only does Haskell make imperative programming a
cinch, but safe and correct as well. Follow along! This post is written in
Literate Haskell, so its source code can be compiled and run as a program. The
source is [here](https://gist.github.com/gatlin/9696088).

Part the First: The boilerplate
---

Surprisingly, you won't need much boilerplate for this exercise:

> {-# LANGUAGE DeriveFunctor #-}
> {-# LANGUAGE StandaloneDeriving #-}

> import Control.Monad.Free

Haskell already has built in notions of Functors, Monads, and other
mathematical substrate that we'll need as typeclasses.

I'm going to assume you've at least seen the words `Functor` and `Monad`
before, and if you haven't, you should Google around for any one of the
thousands of existing explanations.

Importing `Control.Monad.Free` brings in what has been
my favorite feature of late: the Free monad.

The Free monad is what it sounds like: it is a generic instance of the `Monad`
typeclass. All you have to do is supply a `Functor` type and the `Free` type
constructor spits out a `Monad`.

Part the Second: SHOW ME ALREADY
---

*Voici*:

> newtype Then k = Then k
> deriving instance Functor Then
> type Imperative = Free Then

That's it. `Imperative` is now a monad. But what does it *do*? Good question -
that's the part we must fill in. In our case we wish to be able to write
imperative, this-then-this-then-this style programs.

Part the Third: Give my creation ... LIFE!
---
![Dr Frankenstein has been a very naughty boy](http://i.imgur.com/afH9ODT.jpg)

So now we should specify the behavior of our newly minted monad. We will define
a function that evaluates programs in our little monad.

> imperative :: Imperative a -> a
> imperative (Free (Then next)) = imperative next
> imperative (Pure v)           = v

We did it. Really. This code says that if we get a value of `Free` we should
unpack the value inside of it and loop; otherwise, we have broken the program
down as far as we can and should evaluate the expression we have uncovered.

Part the Fourth: Examples
---

We'll write some simple arithmetic functions, including the types for
pedagogical thoroughness:

> mySquare :: Int -> Imperative Int
> mySquare n = return $ n * n

> myAdd1 :: Int -> Imperative Int
> myAdd1 n = return $ n + 1

And for legibility later, I'll define this stupid thing:

> set :: a -> Imperative a
> set = return

You get the idea. And now for an example usage. Remember, in Haskell you get
fancy "do-notation" when you're doing work inside a monad.

> ex1 :: Int
> ex1 = imperative $ do
>     a <- set 5
>     b <- mySquare a
>     c <- myAdd1 b
>     return c

> main :: IO ()
> main = let v = ex1 in putStrLn . show $ v

Running this, I get `26` in my terminal as expected.

Obviously, the mere existence of such notation indicates the folks who make
Haskell are keenly aware of what I'm saying; the whole reason we're talking
about monads right now is because Philip Wadler thought of this first.

But I hope I showed you how *easy* this is. Monads are programmable semicolons.
(NB: Python has semicolons, too, but you probably never use them.) The `Free`
monad makes it ridiculously easy to create monads. I've defined arguably the
most trivial monad one can define, in like 15 lines of real code, and already
this code is as easy to write as something like Python but with static type
safety.

Not that I don't like Python - I feed myself writing it these days - but
complexity does not have to be daunting or impossible. Often, a good amount of
upfront complexity enables extreme simplicity later.

