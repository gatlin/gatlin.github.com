---
title: An example-driven explication of monads written on vyvanse
lead: Or, How you too can be alone and stay that way.
...

It's said that all Haskell programmers eventually write a blog post explaining
Monads. Today I fulfill my destiny. The basic format is ripped from "Learn You A
Haskell For Great Good," but these are my own crappy examples.

This blog post is literate Haskell; you can get it
[here](https://gist.github.com/4145341). You can import it into ghci and type
the functions to see their output (`ghci monads.lhs`). For this to work, we'll
need to import one module for use later:

> import Control.Applicative

A *functor* generalizes the notion of types to a type with context. For example,
the Maybe type is literally this:

    Maybe a = Just a | Nothing

It wraps a simple type into the notion of uncertainty, so Maybe is a functor.
The list type is really `List a` is a list, but you can think of lists as
functors generalizing types into the notion of non-determinism. To be a functor,
a type must implement `fmap` which has a type signature of `(a -> b) -> f a -> f
b`. Or concretely:

> example1 = fmap (*2) (Just 4)

    Just 8

An *applicative functor* takes this further and generalizes the notion of
function application inside a context. In addition to `fmap`, a type that wants
to be an applicative functor must implement `<*> :: (a -> b) -> f a -> f b`. The
only difference between it and `fmap` is that the first argument, the function
to be applied, must be inside the context already. Take a breath and read this
example:

> even? x
>   | x `mod` 2 == 0 = True
>   | otherwise = False

> example2 = (even?) <$> [1..12] -- <$> is just fmap, but sexier to go with <*>

    [False,True,False,True,False,True,False,True,False,True,False,True]

Note that Haskell gives Lists special treatment because they're so fundamental.
So we write `[a]` instead of `List a` and, though we didn't show it here, `fmap`
is just the normal `map` function you expect.

> example3 = (*) <$> [1,2] <*> [3,4,5]

    [4,5,6,5,6,7]

The result of applying `(*)` to `1` is a function that accepts one argument and
returns the product. `<$>` will return this new function wrapped in the List
context and `<*>` can then apply this contextualized function to `[3,4,5]`, in
order.

> example4 = [  (*1),  (*2)  ] <*> [1..4]

    [1,2,3,4,2,4,6,8]

Note the length of the resulting lists is the product of the length of each
list. One more to drive that point home:

> example5 = [ (*x) | x <- [1..3] ] <*> [1..4]

    [1,2,3,4,2,4,6,8,3,6,9,12]

Where functors generalize types inside contexts, and applicative functors
generalize application inside contexts, *monads* generalize **composition**
inside contexts.

A monad must implement `>>= :: m a -> (a -> mb) -> m b`, which you pronounce as
"bind." It takes a value wrapped in a monad context (`m`) and a function from a
non-monadic value to a monadic value, and applies them. The result is something
that can be used all over again in the same way. Example!

> example6 = ((take 5) . repeat) 2 -- signature is just a -> [a]

    [2,2,2,2,2]

`example6` returns a List of values, so it returns a monad.

> example7 = [2,3] >>= ((take 5) . repeat)

    [2,2,2,2,2,3,3,3,3,3]

Haskell has a special notation for monad computations called do-notation. It
should illuminate the relationship between imperative programming and monads:

> example8 = do
>     l <- [2,3]
>     ((take 5) . repeat) l

    [2,2,2,2,2,3,3,3,3,3]

But let's focus on what just happened: I took a list of values and a function to
act on a single value and applied it to the entire list *without explicit
iteration.*

wtfbbqomg.

That's the magic of monads, really. A monad is a polymorphic type that
generalizes the notion of function composition, and because of this you can do
interesting things *during* composition. The Maybe monad does similar things:

> ensureEven x
>     | x `mod` 2 == 0 = Just x
>     | otherwise = Nothing

> example9 = do
>    a <- ensureEven 2
>    b <- ensureEven $ a * 2;
>    return b

    Just 4

> example10 = do
>    a <- ensureEven 2
>    b <- ensureEven $ a + 1
>    return b

    Nothing

So, a summary:

* Functors generalize types;
* Applicative functors generalize application;
* Monads generalize composition.

The point of generalization is to let you assign some interesting or novel
meaning to these abstract ideas. List models non-determinism; Maybe models
simple uncertainty; IO models, uh, IO actions.

That's why it kind of misses the point to say "monads model state." Certainly
they can, but what they really do is so much more powerful. Here is `example10`
without the do-notation:

> example11 = (ensureEven 2) >>=
>    (\a -> ensureEven (a + 1) >>=
>        (\b -> return b))

The result of `ensureEven 2` is fed into a single function: an anonymous
function with a free variable `a`. It in turn contains an inner anonymous
function `(\b -> return b)`, which, thanks to the magic of lexical scope, can
see `a`. And that's why

> example12 = do
>    putStrLn "Enter some text:"
>    input <- getLine
>    return input

can safely perform IO: the IO monad generalizes composition such that functions
are called in the order they need to be in the real world (ie, asking for text
before listening for it) and the "variables" can't be shared or mutated without
you knowing.

Hope this made some sense.

