---
title: Operational Transformation in Haskell
lead: Or, Who Edits the Edits?
...

This article documents my attempts to understand
[operational transformation][otwiki] for both personal edification and
profit, as I'm working on a project which requires it.

I found an [excellent resource][otarticle] explaining the practical
theory of OT and
[a relatively straightforward JavaScript implementation][otjs] but
nothing substantial with both theory *and* code side by side.

*I like to program in Haskell. Some people are automatically turned off
by this for weird religious or perhaps medical reasons, but for
everyone else I think Haskell's case notation and the particulars of
the OT algorithm pair surprisingly well together.*

**My Goals**:

1. Create a domain specific language (DSL) for constructing edits to
   text;
2. Build an interpreter for this DSL which applies edits to an initial
   document string.
3. Write an algorithm for transforming concurrent document edits so
   that they may be applied in sequence.
   
The first two goals allow me to actually verify that I've achieved my
third one.

This should also serve as an instructive guide to creating DSLs and
interpreters using slick design patterns.

## First things first 

So, first, some language extensions which save me typing, and some
libraries I'll be using:

```haskell
{-# LANGUAGE DeriveFunctor #-}
{-# LANGUAGE MultiParamTypeClasses #-}
{-# LANGUAGE FlexibleInstances #-}

import Data.List (splitAt)
import Data.Monoid
import Data.Ord
import Control.Monad
import Control.Comonad
import Control.Monad.Free
import Control.Comonad.Cofree
```

So that the code is more readable, I'll create a type alias for
`String` called `Document` so that functions editing documents can
basically just say that:

```haskell
type Document = String
```

## The Operation DSL

In OT, the basic idea is different parties editing the same document
in real time don't send new versions of a document to the server but
*operations on the document*. Operations describe edits to a document
at the cursor position. There are three operations in my system:

- `insert`: insert a string at the current position, and move the
  cursor to the end of the string;
- `delete`: delete *n* characters at the current position, leaving the
  cursor unchanged;
- `retain`: move the cursor forward *n* characters.

Operations may be composed to create a new operation containing
both. This is important because of an important restriction OT
imposes: all operations sent to the server *must span the length of
the resulting document.*

For example, if I have the document "hello world" and I want to
capitalize "hello" I can't submit `delete 1, insert "H"`. Instead, I
submit `delete 1, insert "H", retain 10`.

The monad design pattern lets you, among other things, define domain
specific languages. The so-called "free" monad is really cool because
it lets you write up your grammar as a data type and then "for free"
turn it into a DSL with no implementation (yet).

Enough talk!

```haskell
data OperationGrammar k
  = Insert String k
  | Delete Int k
  | Retain Int k
  deriving (Show, Functor)

type Operation = Free OperationGrammar ()
```

OH MY GOD WASN'T THAT SO COMPLICATED AND SCARY WHAT NORMAL HUMAN COULD
READ THAT. Ahem.

The `k` parameter is a mnemonic for "continuation." Basically this
means that an operation has two things following it: its argument, and
then another operation *or* a signal that we are finished. The `Free`
type handles tying that knot for us.

So now we have a type describing our operation language: an operation
is one of three different values. We can create command functions for
each operation using the `liftF` function from `Control.Monad.Free`:

```haskell
insert :: String -> Operation
insert str = liftF $ Insert str ()

delete :: Int -> Operation
delete str = liftF $ Delete str ()

retain :: Int -> Operation
retain n = liftF $ Retain n ()
```

So now we can create an operation like this:

```haskell
my_first_op :: Operation
my_first_op = do
    delete 1
    insert "H"
    retain 10
```

At last, we have a type-safe language for writing document
operations. But how do we *use* them?

## An interpreter for our language

Monads are like languages; *comonads* are like interpreters. And just
as there is a "free" monad there is a "cofree" comonad which takes a
type describing an interpreter and hands you back one ready to
program. How does that work?

For every command in our language our interpreter must contain a handler which
executes the correct action. Different interpreters might, uh, interpret the
language differently: one might edit a local document, one might simply
pretty-print the operations in a log, one might do both, etc.

Thus I will define the `Cursor` to be the interpreter of an `Operation`:

```haskell
data CursorF k = CursorF
  { insertH :: String -> k
  , deleteH :: Int    -> k
  , retainH :: Int    -> k
  } deriving (Functor)

type Cursor = Cofree CursorF
```

A `Cursor a` is given some initial value of type `a`. It interprets expressions
in the `Operation` language using its handler functions to transform this
initial value into subsequent `a` values.

Since we actually want to apply edits to a document, though, we will need the
`Cursor` to keep track of a `Document` and in index into it. I call this kind of
`Cursor` an `Editor`:

```haskell
type Editor = Cursor (Int, Document)
```

Cofree comonads essentially receive an instruction, adjust their internal value
accordingly, and then produce a new cofree comonad. In this light, all cofree
comonads are like streams: they'll produce an infinite series of states if you
provide an infinite series of expressions.

The `free` package provides the `coiter` function which helps us construct
cofree comonads by supplying logic for

- where to start; and
- how to step forward

Using `coiter` we can build new `Editors`!

```haskell
newEditor :: (Int, Document) -> Editor
newEditor start = coiter next start where
  next w = CursorF (coInsert w) (coDelete w) (coRetain w)
```

Of course, we must also define the functions describing how to proceed with each
specific command. In case you're wondering, yes, this is *finally* where we give
operational semantics to the `Operation` commands.

```haskell
coInsert :: (Int, Document) -> Document -> (Int, Document)
coInsert (idx, doc) str = (idx', doc') where
  idx' = idx + length str
  doc' = pre ++ str ++ post
  (pre,post) = splitAt idx doc
```

```haskell
coDelete :: (Int, Document) -> Int -> (Int, Document)
coDelete (idx, doc) n = (idx, doc') where
  doc' = pre ++ (drop n post)
  (pre,post) = splitAt idx doc
```

```haskell
coRetain :: (Int, Document) -> Int -> (Int, Document)
coRetain (idx, doc) n = (idx + n, doc)
```

I really like the cofree comonad design pattern because I can break up an
interpreter for a language into small parts like this and clearly see what each
one is supposed to do.

## Running our edits

We are finally ready to interpret `Operation`s with our `Editor`. However, we
are in a slight pickle. The process of feeding our language into our interpreter
is one of first determining if the `Operation` is finished or not (so
determining what `Cofree` should do based on `Free`) **and then** determining
which `CursorF` function shuold be called based on the `OperationGrammar` value.

In Haskell when you want a function overloaded for different types you use type
classes. So here is the `Run` typeclass, containing the method `run`:

```haskell
class (Functor f, Functor g) => Run f g where
  run :: (a -> b -> r) -> f a -> g b -> r
```

`run` will accept three arguments. The last two are types wrapping values of
interest; the first is a combiner function which wants those values of interest.

An `f a` can `Run` a `g b` if you can describe how to pick them apart and get at
those interesting values.

For `CursorF` and `OperationGrammar` it's dead simple:

```haskell
instance Run CursorF OperationGrammar where
  run f (CursorF i _ _) (Insert s k) = f (i s) k
  run f (CursorF _ d _) (Delete s k) = f (d s) k
  run f (CursorF _ _ r) (Retain n k) = f (r n) k
```

Each case is explained in essentially the same way: we'll take the argument from
the command, we'll give it to the correct handler function, and the result will
be the first argument to our combiner. The result of the `OperationGrammar`
value will be second.

We also need to describe how `Cofree` can, in general, run `Free`. Voici:

```haskell
instance Run f g => Run (Cofree f) (Free g) where
  run p (a :<  _) (Pure x) = p a x
  run p (_ :< fs) (Free gs) = run (run p) fs gs
```

Note that here, in the case where we aren't finished, `run` refers to
itself. Because we defined `run` as a typeclass instance, the correct `run` will
be selected each time.

To put all of this together, we define `edit` which takes a `Document` and an
`Operation` and returns a new `Document` and its length.


```haskell
edit :: Document -> Operation -> (Int, Document)
edit doc ops = run const (newEditor (0, doc)) ops

my_stupid_edit = do
  let doc = "hello world"
  let op = delete 1 >> insert "H" >> retain 10
  let (_, doc') = edit doc op
  putStrLn doc' -- "Hello world"

```

## Transforming operations

Now we have a DSL for operations and an interpreter which can apply them to
documents. But that's not really why we're here. We want to learn how to
*transform* operations so that concurrent edits to the same parent document may
be composed into a consistent document that makes sense to all parties.

We want to take two concurrent operations, which can't be applied sequentially,
and produce a pair of analogous operations which *could* be applied
sequentially. For instance, if two concurrent edits `a` and `b` are sent to the
server and `a` is processed first, we want to transform `b` into a `b'` which
may be applied after `a`.

Of course, the author of `b` has undoubtedly already applied `b` to their local
document, so they'll need an `a'` from the server which they can use to
incorporate the `a` changes. Ultimately, both clients and the server will need
to arrive at the same document.

We will call this function `rebase` because of its similarity to the rebase
functionality in `git`. `rebase a b` will compute both `a'` and `b'`.

Let's get started. Initial case: both expressions are empty.

```haskell
rebase :: Operation -> Operation -> (Operation, Operation)
rebase a b = go a b (return (), return ()) where
  go (Pure ()) (Pure ()) result = result
```

```haskell
  go (Free (Insert s k)) b (a', b') =
    go k b (a' >> insert s, b' >> retain (length s))

  go a (Free (Insert s k)) (a', b') =
    go a k (a' >> retain (length s), b' >> insert s)
```

```haskell
  go a b (a', b') = case (a, b) of
    (Free (Retain n1 k1), Free (Retain n2 k2)) ->
      let ops minl = (a' >> retain minl, b' >> retain minl)
      in  case compare n1 n2 of
            EQ -> go k1 k2 $ ops n2
            GT -> go (Free (Retain (n1 - n2) k1)) k2 $ ops n2
            LT -> go k1 (Free (Retain (n2 - n1) k2)) $ ops n1
```
            
```haskell
    (Free (Delete n1 k1), Free (Delete n2 k2)) ->
      case compare n1 n2 of
        EQ -> go k1 k2 (a', b')
        GT -> go (Free (Delete (n1 - n2) k1)) k2 (a', b')
        LT -> go k1 (Free (Delete (n2 - n1) k2)) (a', b')
```

```haskell
    (Free (Delete n1 k1), Free (Retain n2 k2)) ->
      let ops minl = (a' >> delete minl, b')
      in  case compare n1 n2 of
        EQ -> go k1 k2 $ ops n2
        GT -> go (Free (Delete (n1 - n2) k1)) k2 $ ops n2
        LT -> go k1 (Free (Retain (n2 - n1) k2)) $ ops n1
```

```haskell
    (Free (Retain n1 k1), Free (Delete n2 k2)) ->
      let ops minl = (a', b' >> delete minl)
      in  case compare n1 n2 of
        EQ -> go k1 k2 $ ops n2
        GT -> go (Free (Retain (n1 - n2) k1)) k2 $ ops n2
        LT -> go k1 (Free (Delete (n2 - n1) k2)) $ ops n1
```

```haskell
a, b :: Operation
a = do
  retain 11
  insert " dolor"

b = do
  delete 6
  retain 5
```

```haskell
test_rebase :: IO ()
test_rebase = do
  let (_, doc_a) = edit testDoc a
  let (_, doc_b) = edit testDoc b
  let (b', a') = xform b a
  let (_, doc_a_b') = edit doc_a b'
  let (_, doc_b_a') = edit doc_b a'
  putStrLn doc_a_b' -- "ipsum dolor"
  putStrLn doc_b_a' -- "ipsum dolor"
```

[freepkg]: http://hackage.haskell.org/package/free
[otkwiki]: https://en.wikipedia.org/wiki/Operational_transformation
[otarticle]: http://www.codecommit.com/blog/java/understanding-and-applying-operational-transformation
[otjs]: https://raw.githubusercontent.com/Operational-Transformation/ot.js/master/dist/ot.js
[laing]: http://dlaing.org/cofun/posts/free_and_cofree.html

[^1]: We know, we know, obviously Haskell interacts with the real
    world and mutates state in the runtime. I wish this strawman would
    fucking catch fire already.
