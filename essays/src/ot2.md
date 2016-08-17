---
title: Operational Transformation in Haskell, Part 2
lead: Or, Thank You (Re)based God
...

In my [previous article][previous] I outlined a project to implement
[operational transformation][ot] in Haskell. I defined a domain specific
language for operations on documents - `insert`, `delete`, and `retain` (skip) -
and built an interpreter it which would correctly apply operations to a
"document," in this case a run-of-the-mill `String`.

For convenience here is an example of the DSL in action:

```haskell
opA :: Operation
opA = do
    delete 1
    insert "H"
    retain 10

editor_test :: IO ()
editor_test = do
    let doc = "hello world"
    let (result_length doc') = edit doc opA
    putStrLn doc'
    -- prints "Hello world"
```

Here we define a series of edits we wish to make to a `String` as a value and
then use it to transform a `String`.

Armed with the ability to see what the fuck we're doing I can now move on to
actually implementing the interesting parts of OT.

As with last time, [the code is available for you to play along at home][otgist].

# What OT really is

OT is used to implement real-time collaboration services which coordinate
multiple authors working on a single document in a way which ensures consistency
among the different authors.

An actual full-fledged OT service is out of the scope of this article. At its
core, though, OT solves the following problem basic problem: if two users make
different edits to the same document and send them to one another, how can each
*change each others' edits* in a way that they'll both end up with the same
document after applying them?

That is, if **User A** and **User B** create edits *a* and *b*, respectively, is
there a way to create edits *a'* and *b'* so that **A** can apply *ab'* and
**B** can apply *ba'* and wind up with the same document?

# Yup

Okay, cool, thanks for reading the article. Just kidding I'm going to drone on
forever with this.

The operation we're searching for is often called *transform* (hence,
"operational transformation"). Given a pair of edits which were ostensibly made
to the same document it can generate the pair of new edits we seek.

Before we define *transform*, though, let's define something useful we'll need
as a prerequisite: composition.

# I <3 Monoids

`Operation`s form a *monoid*: there is a default "empty" value and a "combiner"
function that can take two of them to produce a third; if either argument is our
"empty" value then it is ignored.

So let's define a `Monoid` instance for `Operation`:

```haskell
instance Monoid (Free OperationGrammar k) where
    mempty = return ()
    mappend = (>>)
```

Turns out that the monad "then" operator, `(>>)`, already does what we want. And
the value returned by `return ()` can be treated as an identity for
`mappend`. If we `import Data.Monoid` we can get access to the `(<>)` operator,
which is an infix shorthand for `mappend`. Glad we got that sorted out.

Now we will define *transform!*

# Why couldn't I be good at something that lets me go outside more?

In Haskell recursion isn't the terrible idea it is in some other languages so we
are going to construct our response recursively, starting with a pair of "empty"
operations.

Recall that operations may be composed together so an `Operation` is essentially
a sequence of tagged values indicating which operation should be performed
followed by either another value or the end of the sequence.

It's important to keep our goal in mind: we want to create two *new*
`Operation`s `a'` and `b' such that `a <> b'` and ` b <> a'` result in the same
new document. So some of our logic may be a little weird. I'll type slowly.

```haskell
xform :: Operation -> Operation -> (Operation, Operation)
xform a b = go a b (return (), return ()) where
```

The `go` function will actually handle the construction of our two result
`Operation`s. `return ()` is a little ugly but, in the context of our operation
language, it simply means "do nothing." (See the `Monoid` instance above).

## Case 1: We're finished

```haskell
go (Pure ()) (Pure ()) result = result
```

Since I used the `free` library, the value created by `return ()` is `Pure
()` (if you want to know why, feel free to email me). So in our first case we
check to see if the two `Operation` arguments are essentially finished. If so,
well, whatever result we have constructed thus far is the final one.

## Case 2: Insertions

```haskell
go (Free (Insert s k)) b (a', b') =
    go k b (a' <> insert s, b' <> retain (length s))

go a (Free (Insert s k)) (a', b') =
    go a k (a' <> retain (length s), b' <> insert s)
```

We're going to be biased toward the first `Operation` argument. If it is an
`Insert` command, then we want our first transformed command to be that
insertion, and the second command will skip over that many characters.

If we exhaust all the `insert`s from the first command then we do the same exact
thing for the second command.

Why do we do this? We are trying to create versions of our edits that allow us
to end up with the same document. If the left one has an insert, all we know is
that wherever we are in the document, the right-hand operation needs to move
whatever it was going to do until after the inserted text (or vice versa).

## Cases 3-6

With `insert` out of the way we have only `delete` and `retain` with which to
contend. `insert` changes the cursor position and the document; `delete` changes
only the document and `retain` changes only the cursor position.

We are going to pair up our arguments and look at these four combinations
case-by-case:

```haskell
go a b (a', b') = case (a, b) of
```

### Case 3: Retain / Retain

```haskell
(Free (Retain n1 k1), Free (Retain n2 k2)) ->
    let ops minl = (a' <> retain minl, b' <> retain minl)
    in  case compare n1 n2 of
        EQ -> go k1 k2 (ops n2)
        GT -> go (Free (Retain (n1 - n2) k1)) k2 (ops n2)
        LT -> go k1 (Free (Retain (n2 - n1) k2)) (ops n1)
```

There's a lot going on here. The left-hand operation `retain`s `n1` characters
while the right-hand `retain`s `n2` characters. Our strategy will be to
determine which of the two retained the least, call that number `minl`, and add
`retain minl` to both of our result `Operation`s. The larger of the two
operations, if any, will have more characters to retain so we essentially
replace it with a `retain (larger - smaller)`.

The `compare` function, as well as the values `EQ`, `GT`, and `LT` are from the
`Data.Ord` package.

### Case 4: Delete / Delete

```haskell
(Free (Delete n1 k1), Free (Delete n2 k2)) ->
    case compare n1 n2 of
        EQ -> go k1 k2 (a', b')
        GT -> go (Free (Delete (n1 - n2) k1)) k2 (a', b')
        LT -> go k1 (Free (Delete (n2 - n1) k2)) (a', b')
```

This case is even simpler! If both operations delete the same document at the
same place then we don't need to change the operations at all, we just need to
handle the two cases where one deleted more than the other.

Remember, we're thinking of ways to change one operation to have come *after*
another operation which it didn't know about. If both operations deleted then we
care about handling the difference in how much was deleted.

### Case 5: Delete / Retain

```haskell
(Free (Delete n1 k1), Free (Retain n2 k2)) ->
    let ops minl = (a' <> delete minl, b')
    in  case compare n1 n2 of
        EQ -> go k1 k2 (ops n2)
        GT -> go (Free (Delete (n1 - n2) k1)) k2 (ops n2)
        LT -> go k1 (Free (Retain (n2 - n1) k2)) (ops n1)
```

If the left-hand operation deleted more text than the right side skipped, then
we just ignore the right-hand operation and continue with a `delete (larger -
smaller)` command, which should be familiar by now. If we deleted less than we
skipped, then we `retain (larger - smaller)`.

### Case 6: Retain / Delete

```haskell
(Free (Retain n1 k1), Free (Delete n2 k2)) ->
    let ops minl = (a', b' <> delete minl)
    in  case compare n1 n2 of
        EQ -> go k1 k2 (ops n2)
        GT -> go (Free (Retain (n1 - n2) k1)) k2 (ops n2)
        LT -> go k1 (Free (Delete (n2 - n1) k2)) (ops n1)
```

This is fundamentally the reverse of the previous case.

# And the result?

Let's find out!

```haskell

a, b :: Operation
a = do
    retain 2
    insert "t"

b = do
    retain 2
    insert "a"

test1 :: IO ()
test1 = do
    let (b', a') = xform b a
    let (_, go_a) = edit go_doc a
    let (_, go_b) = edit go_doc b
    putStrLn . show $ edit go_a b' -- "goat"
    putStrLn . show $ edit go_b a' -- "goat"

op1, op2 :: Operation
op1 = do
    retain 11
    insert " dolor"

op2 = do
    delete 6
    retain 5

doc :: Document
doc = "lorem ipsum"

test2 :: IO ()
test2 = do
    let (_, doc_op1) = edit doc op1
    let (_, doc_op2) = edit doc op2
    let (op2', op1') = xform op2 op1
    putStrLn . show $ edit doc_op1 op2' -- (11, "ipsum dolor")
    putStrLn . show $ edit doc_op2 op1' -- (11, "ipsum dolor")
```

While far from a comprehensive test, this suggests we are more or less correct.

# What did all of this mean?

Ultimately, nothing, the Sun will still engulf the Earth when it finally
dies. However, for the time being, we have shown how to

1. Implement a system for describing, composing, and applying text operations to
   documents; and

2. Transform concurrent edits so that multiple parties may arrive at consistent
   document states after applying one another's work.

This article may get more elaboration in the future. Feel free to shoot me an
email in the meantime.

[previous]: /essays/ot.html
[ot]: http://en.wikipedia.org/Operational_transformation
[otgist]: https://gist.github.com/gatlin/1bf02fa50e02a481f7142dd87fe2711f
