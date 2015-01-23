---
title: Deriving free monads from value-level functors
lead: Or, I have finally cured insomnia. Call CNN.
...

This might be the least interesting article title on the Internet. However, it
is something I have been looking into as I work on my language, [psilo][psilo].

[psilo]: http://niltag.net/psilo

So I have a few overlapping concerns:

1. psilo, like Haskell, doesn't semantically support imperative programming
(ie, recipe-style "statement; statement; ..." programming). However, I'm not a
sadist: I want the programmer to be able to write more intuitive programs if
she can *earn it*.

2. I'm a fan of the free monad pattern in Haskell but I don't want to support
typeclasses. Thus I am interested in implementing free monad infrastructure
using nothing but algebraic data types.

3. Since [delimited continuations][delimcont] are tantamount to monads, I want
the user to be able to write what amounts to an abstract syntax tree type and a
few functions in continuation passing style and in return receive a monad, `do`
notation, and composable imperative programming constructs.

[delimcont]: http://okmij.org/ftp/continuations/implementations.html

This post is a simple exploration of implementing the `Functor` typeclass as an
algebraic data type, and then deriving a free monad from it.

Functors and Free Monads
===

> {-# LANGUAGE RankNTypes #-}
>
> data F f = F {
>     _map :: forall a b. (a -> b) -> f a -> f b
> }

An instance of **F** should contain a function called `_map` constrained by
whichever base type is being functor-ized.

> data Mu f a
>     = Term { retract :: a }
>     | Cont (f (Mu f a))

`Mu` is the free monad. I like calling it `Mu` for two reasons: because calling
it "free" is confusing  and not informative; and because `Mu` behaves like the
type-level analog to the Y-combinator, called Mu.

> unit :: a -> Mu f a
> unit = Term
>
> yield :: a -> Mu f a
> yield = Term

These two are different names for the same thing, mostly for aesthetic reasons.
You'll see.

> bind :: F f -> Mu f a -> (a -> Mu f b) -> Mu f b
> bind i arg fn = case arg of
>    Term t      -> fn t
>    Cont k      -> Cont (map (bind' fn) k)
>
>    where map   = _map i
>          bind' = flip (bind i)

This is the cool part. `bind` is defined for any type which is wrapped by `Mu`,
and for a type to be wrapped by `Mu` it must instantiate our `F` type. Thus we
can ask for an "instance" argument, called `i` here.

> sequence' i x   = case x of
>     []      -> unit []
>     m:ms    -> m              >>= \x  ->
>                sequence' i ms >>= \xs ->
>                unit (x:xs)
>     where
>         (>>=) = bind i

For kicks I have re-written the `sequence` function available in Haskell. psilo
will essentially use this or an equivalent function to implement `do` notation
under the covers.

An example: re-creating the `Maybe` monad.
===

Apple's Swift programming language seems to have ignited more widespread
interest in optional types. So, just to show there is nothing up my sleeves, I
am re-creating the `Maybe` monad with the name `Optional`.

> data Optional s
>     = Nil
>     | Some s
>     deriving (Show)

Now for the fun part. I will create an `F` instance for `Optional` along with
some convenience functions to use in monadic computations. While I don't do it
here, this could be [derived automatically][derivefunctor].

[derivefunctor]: http://www.haskell.org/pipermail/haskell-prime/2007-March/002137.html

> fOptional :: F Optional
> fOptional = F {
>     _map = \f x -> case x of
>         Nil     -> Nil
>         Some s  -> Some $ f s
> }
>
> nil = Cont Nil
> some = Term

In ~12 lines of real code, I have created a `Maybe` clone and proven it is a
functor. As a result all the remaining code necessary to compose a monad has
been derived automatically.

Since this was a free monad, the only remaining code is that to "run" the
monadic computation built up using `unit` and `bind`.

> runOptional :: Mu Optional a -> Optional a
> runOptional (Term t) = Some t
> runOptional (Cont k) = case k of
>     Nil     -> Nil
>     Some v  -> runOptional v

Tests!
===

Without further ado, here is some example code written in our `Optional` monad.

> testOptional1 = some 5 >>= \a ->
>                 some 6 >>= \b ->
>                 yield $ a * b
>     where (>>=) = bind fOptional
>
> testOptional2 = some 5 >>= \a ->
>                 nil    >>= \b ->
>                 some 6 >>= \c ->
>                 yield $ a * c
>     where (>>=) = bind fOptional

Try it out for yourself to see the results. 
