---
title: Going back to the future with fix points of things that don't exist yet
lead: "Or, what's Löb got to do with it?"
...

*This is an attempt at writing a more succinct exploration of the topics found
[here][sigfpe]; I do not claim this as original work.*

[sigfpe]: http://blog.sigfpe.com/2006/11/from-l-theorem-to-spreadsheet.html

In provability logic, Löb's theorem states:

    □ ( □ P → P ) → □ P

In English, "If a system has Peano arithmetic, then if for any *p* the
statement 'if *p* is provable then *p* is true' is true, then *p* is provable."

According to the [Curry-Howard isomorphism][ch], in type systems like that of
Haskell's types correspond to logical propositions, and functions inhabiting
those types are proofs. So if a type's definability implies its validity then
it is definable.

[ch]: http://en.wikipedia.org/wiki/Curry%E2%80%93Howard_correspondence

Somebody had this bright idea of pretending □ was some functor *f* and encoded
this property in a function called `loeb`:

> loeb :: Functor f => f (f a -> a) -> f a
> loeb x = fmap (\a -> a (loeb x)) x

How could this be useful? Recalling that the type `[a]` is a functor,

> test_loeb_1 = [ length , \x -> x !! 0 ]

```haskell
ghci> loeb test_loeb_1
[2,2]
```

wat?

Intuitively it's like a spreadsheet: you take (in this case) a row of cells
containing functions which assume the final spreadsheet is finished, and they
can rely on each other for their final values.

`length` and `\x -> x !! 0` are both functions which accept a list as an
argument and return a single item of the list. The length of the `test_loeb_1`
list is 2 so `length` is 2, and thus `x !! 0` is 2.

Here's a more elaborate example:

```haskell
test_loeb_2_bad = [ (!! 5), 3, (!! 0) + (!! 1), (!! 2) * 2, sum . take 3, 17 ]
```

However, this is bad because `3` and `17` aren't functions. Haskell has a
standard function, `const :: a -> b -> a`, which we can use to turn ordinary
values into functions:

> test_loeb_2 :: [[Int] -> Int]
> test_loeb_2 = [ (!! 5), (const 3), (\l -> (l !! 0) + (l !! 1))
>               , \l -> (l !! 2) * 2, sum . take 3 , (const 17 )]

So now I run `test_loeb_2` ...

```haskell
ghci> loeb test_loeb_2
[17,3,20,40,40,17]
```

I took the fix point of a value that didn't exist yet and tied a very strange
temporal knot. Thanks, Löb!

