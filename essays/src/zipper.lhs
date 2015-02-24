---
title: Excelsior!
lead: "Or, I may have finally gone insane"
...

I've written [previously][l] about Löb's theorem and the curious manner in
which we can evaluate a list of functions which depend on each other's outputs
*simultaneously* without much fuss, like a shitty one-row spreadsheet.

[l]: http://niltag.net/essays/loeb.html

Today I am going to get inter-dimensional.

Well, two-dimensional. But I am going to ... *Excel* at it.

![Tom Cruise doing a 'finger
gun'](http://nerdbastards.com/wp-content/uploads/2012/03/Tom-Cruise-finger-gun.jpg)

Imports and blah blah
===

> {-# LANGUAGE DeriveFunctor #-}

> import Control.Applicative
> import Control.Comonad
> import Data.Function (fix)
> import Control.Monad

That's right: today we are dealing with *comonads*. Monads just weren't
confusing enough so I turned them upside down and backward.

(NB: given that the definition of `fix` is `fix f = f (fix f)` I actually typed
nine *more* characters importing it than just writing it here. Meh.)

Also there's a standard library function whose name I want to use but which is
otherwise useless for this exercise:

> import Prelude hiding (iterate)

Double Löb-el
===

To recap, by abusing Löb's theorem we were able to write this:

> loeb :: (Functor f) => f ( f a -> a ) -> f  a
> loeb x = fmap (\a -> a (loeb x)) x

Since the goal is to recreate a spreadsheet, and the cells of a spreadsheet
contain functions, we will tell the Haskell compiler how to treat functions as
placeholders for numbers. Fortunately, `Num` is a class which only has a few
simple methods to define:

> instance (Num a, Eq a) => Num (x -> a) where
>     fromInteger = const . fromInteger
>     f + g = \x -> f x + g x
>     f * g = \x -> f x * g x
>     negate f = \x -> negate (f x)
>     abs f = \x -> abs (f x)
>     signum f = \x -> signum (f x)

These functions basically say that if I use a function where a number should
go, create a new function where I wait on an actual number and then do stuff
with it.

Your zipper is undone
===

So a fixed length list of functions is cool but, and I don't know about you,
but when I use Excel it's kind of infinite in all directions.

But how do I represent an infinite list in such a way that I can navigate it,
read data from it, and modify its internals? The structure I'll use is often
called a *list zipper*.

> data Zipper a = Zipper
>     { viewL :: [a]
>     , focus :: a
>     , viewR :: [a]
>     } deriving (Functor, Show)

A list zipper is like a cursor: it has a current focus element and lists of
elements on either side of the focus it can navigate to. Accessing or modifying
the focus is a constant time operation.

Moving "left" (or "right") amounts to prepending the focus to one list and
popping the head off the other one, creating the new focus. These are also
constant time operations.

> moveL :: Zipper a -> Zipper a
> moveL (Zipper (l:ls) c rs) = Zipper ls l (c:rs)

> moveR :: Zipper a -> Zipper a
> moveR (Zipper ls c (r:rs)) = Zipper (c:ls) r rs

It so happens that a `Zipper` is an `Applicative`:

> instance Applicative Zipper where
>     (Zipper ls c rs) <*> (Zipper ls' c' rs') =
>         Zipper (ls <*> ls') (c c') (rs <*> rs')
>     pure = Zipper <$> pure <*> id <*> pure

If you don't what `Applicative` is, skip to the end of this post and then come
back.

Zippity doo-dah
===

We have created a zipper to anchor us at a desired location in an infinite
list, so to get started using our zipper we'll need to be able to create an
infinite list. Voici:

> unfold :: (b -> (a, b)) -> b -> [a]
> unfold f c =
>     let (x, d)  = f c
>     in  x:(unfold f d)

`unfold` is like the opposite of a traditional list *fold*: instead of
iterating over a list and accumulating some result value, we take an initial
value and generate a list from it according to some pre-determined rule.

Armed with a means of generating infinite lists according to some rule, we can
now *seed* new zippers with some initial focus value:

> seed :: (c -> (a, c)) -- \
>      -> (c -> a)      --  \
>      -> (c -> (a, c)) --   - Type signatures are so fun!
>      -> c             --  /
>      -> Zipper a      -- /
> seed prev center next =
>     Zipper <$> unfold prev <*> center <*> unfold next

Basically, take the fourth argument, `unfold` two infinite lists with it based
on some generating rules, and set it as the focus.

Note the type signature says `seed` has four values but the function only has
three: `Zipper <$> unfold prev <*> center <*> unfold next` creates a function
awaiting the final argument.

Back to the future!
===

It so happens that our `Zipper` is a *comonad*. The name comes from the fact
that it is the mathematical dual of another concept that already had a name,
and mathematicians are kind of predictable that way.

All comonads are functors, in that they provide some kind of computational
context for a value. Here's one way of thinking about comonads: a structure is
comonadic if we always know how to get a value from it.

A comonad must also allow me to duplicate its values: if I have a comonadic
structure containing values of type `a`, then I can create a structure of
structures. This is confusing and mind-bendy to think about so if it doesn't
make sense just go with the flow.

The reason, though, is that comonads describe computations where, instead of
sequentially moving from state to state reacting to and causing effects like
normal imperative programming, we instead are presented with multiple
simultaneous future states. We can write a function to transform one of them,
abstractly, and this function will be applied to all possible future states.

This is intimately related to the fact that we know for certain we will be able
to yank a value out of the comonad: thus, we can borrow against the future.

Thus, a comonad must implement these functions [^1]:

```haskell
extract :: (Comonad w) => w a -> a
-- and
duplicate :: (Comonad w) => w a -> w (w a)
```

`extract` is easy: hand back the focus of the `Zipper`. That's kind of why we
have it in the first place.

What about the `duplicate` function? We know we can create a `Zipper` by giving
a seed value to `seed`. What if that seed value was a `Zipper`? What does a
`Zipper` of `Zipper`s look like?

Let's take this shit slow. A `Zipper` of, say, `Int` values

> z1 = seed (\x -> (x-1,x-1)) 0 (\x -> (x+1,x+1))

like this one is focused on some number, and the values to the left and right
are modifications defined by some transformation function (in this case, adding
or subtracting 1).

So a `Zipper` of `Zipper`s is focused on one zipper and the left and right
neighbors are other zippers. How we want to transform the focus should really
just be left up to the user. Hence:

> iterate :: (a -> a)
>         -> (a -> a)
>         -> a
>         -> Zipper a
> iterate prev next =
>     seed (dup . prev) id (dup . next)
>     where dup a = (a, a)

Thus, our comonad instance is complete:

> instance Comonad Zipper where
>     extract = focus
>     duplicate = iterate moveL moveR

`duplicate` creates a `Zipper` of `Zippers` where the focus is our original and
moving in either direction transforms the focus by moving it.

HEAD ASPLODE

Zip it good
===

Comonads also have a function, `extend`, which is defined in terms of
`duplicate`:

```haskell
extend :: (Comonad w) => (w a -> b) -> w a -> w b
extend = fmap f . duplicate
```

So if we can extract a value of type `a` and transform it into a `b` then we
can extend the whole comonad to being a comonad of `b` values.

Another standard function defined on comonads is the fixpoint:

```haskell
wfix :: Comonad w => w (w a -> a) -> a
wfix w = extract w (extend wfix w)
```

If I have a comonad containing an extract procedure (or perhaps multiple
extraction procedures) I can compute a fixed point of those functions and
extract the final value.

I noticed that `extend wfix` has a very interesting type signature:

> evaluate :: (Comonad w) => w (w a -> a) -> w a
> evaluate = extend wfix

Intredasting.

`Zipper` is a comonad. If we have a `Zipper` of functions which ... evaluate
`Zipper`s then ... holy shit.

Holy shit
===

So let's create a `Zipper` of functions that evaluate `Zipper`s:

> zipper_1 :: Zipper (Zipper Int -> Int)
> zipper_1 = Zipper (repeat ((*2) . extract . moveR))
>             1 (repeat ((+1) . extract . moveL))

The initial focus is `1`; as you move left, you double; as you move right, you
add 1.

For convenience let's write a function to extract a subsection of a `Zipper`
into a list for viewing:

> toList :: Int -> Zipper a -> [a]
> toList n (Zipper ls x rs) =
>     reverse (take n ls) ++ [x] ++ take n rs

```haskell
ghci> toList 5 (evaluate zipper-1)
[32,16,8,4,2,1,2,3,4,5,6]
```

Holier Shit
===

I said we were going interdimensional, and I'm no liar.

![Picture of the Beastie Boys' Intergalactic
album](http://upload.wikimedia.org/wikipedia/en/4/4b/BeastieBoysIntergalactic.jpg)

We have already shown we can create `Zipper`s of `Zipper`s on-demand, and the
result is an infinite list of variations on an initial `Zipper`.

Let's make this official:

> data Cursor a = Cursor (Zipper (Zipper a))

> up :: Cursor a -> Cursor a
> up (Cursor p) = Cursor (moveL p)

> down :: Cursor a -> Cursor a
> down (Cursor p) = Cursor (moveR p)

By convention, we'll say that going left on the outer `Zipper` is going "up,"
and vice versa. A `Cursor` is a `Functor`:

> instance Functor Cursor where
>     fmap f (Cursor p) = Cursor (fmap (fmap f) p)

Going left and right, though, is a little hairy: we want to shift every single
`Zipper` left or right uniformly. Fortunately, we *just* defined `Cursor`s as
`Functor`s, so we'll just `fmap` the movements inside the outer `Zipper`:

> left :: Cursor a -> Cursor a
> left (Cursor p) = Cursor (fmap moveL p)

> right :: Cursor a -> Cursor a
> right (Cursor p) = Cursor (fmap moveR p)

A `Cursor` is also a comonad. `extract` is just extracting the focus of the
focus `Zipper`. `duplicate` is a little weirder. We want to generate a `Cursor`
of `Cursor`s. Following from the same trick we used for `Zipper`s:

> horizontal :: Cursor a -> Zipper (Cursor a)
> horizontal = iterate left right

> vertical :: Cursor a -> Zipper (Cursor a)
> vertical = iterate up down

We can declare the `Cursor` a comonad and move on with our lives:

> instance Comonad Cursor where
>     extract (Cursor p) = extract $ extract p
>     duplicate z =
>         Cursor $ fmap horizontal $ vertical z

We created the `Cursor` to allow us to do two-dimensional spreadsheet-esque
programming so it'd be nice if I could write some easy-to-read grid of
functions and then make a `Cursor` out of them.

And lo:

> makeCursor :: a -> [[a]] -> Cursor a
> makeCursor def grid = Cursor $ Zipper (repeat fz) fz rs where
>     rs = (map line grid) ++ repeat fz
>     dl = repeat def
>     fz = Zipper dl def dl
>     line l = Zipper dl def (l ++ dl)

Armed and ready, let's create a spreadsheet with default cell values of `0` and
two functions in the same column:

> sheet1 :: Cursor (Cursor Int -> Int)
> sheet1 = makeCursor 0
>     [ [ (\c -> 15 + 2 * (extract (left c)))   ]
>     , [ (\c -> 1 + (extract (up c)))          ] ]

It would be nice if we could view some subset of our `Cursor` as a list of
lists, analogously to our `toList` function.

> cursorView :: Int -> Cursor a -> [[a]]
> cursorView n (Cursor zs) = toList n $ fmap (toList n) zs


Let's run this in `ghci`:

```haskell
ghci> let rows = sheet1 & evaluate & cursorView 5
ghci> forM_ rows (putStrLn . show)
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,15,0,0,0,0]
[0,0,0,0,0,0,16,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]
[0,0,0,0,0,0,0,0,0,0,0]

```

Boom.

*The definition of `(&)` is very simple:*

> (&) = flip ($)

Excursor-sions
===

For completeness, let's define a way to insert a value at the focus of a
`Cursor` or a `Zipper`. I made up a simple typeclass for things that can be
inserted into so that I wouldn't have to have `insertCursor` and `insertZipper`
or some other ugly nonsense.

> class Insertable i where
>     insert :: a -> i a -> i a

> instance Insertable Zipper where
>     insert x (Zipper l _ r) = Zipper l x r

> instance Insertable Cursor where
>     insert x (Cursor p) =
>         Cursor $ insert newLine p where
>             newLine = insert x oldLine
>             oldLine = extract p

Appendix: Applicative what-now?
===

An *applicative functor* is a *functor* with a little extra power. A *functor*
is a computational context into which you can map transformations. Concrete
example: `Maybe Int` lets me map `Int` functions into a context where there may
not be an actual value. `fmap (+1) (Just 1)` gives `Just 2` even though `(+1)`
knows nothing of `Maybe`. However, `fmap (+1) Nothing` gives `Nothing`.

Applicative functors let you take a function which is *already in the context*
and map it onto contextualized values. A type signature is worth a thousand
words:

```haskell
(<*>) :: (Applicative f) => f (a -> b) -> f a -> f b
```

Example:

```haskell
ghci> Just (\x y -> x * y) <*> Just 3 <*> Just 4
Just 12
```

An `Applicative` must also give you a way of lifting pure values into the
functor. Hence:

```haskell
pure :: (Applicative f) => a -> f a
```

If your functor can support `(<*>)` and `pure` then congratulations, it is also
`Applicative`. There are a number of cases where `Applicatives` are handy or
convenient.

[^1]: This is a bit over-simplified. A third function, `extend`, may be defined
in place of `duplicate`. Each has a default implementation defined in terms of
each other, so you only have to specify one.
