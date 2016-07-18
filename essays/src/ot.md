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
program.

Each command in our language takes an argument and a continuation of
some kind. So an interpreter for each will accept whatever argument is
necessary and *return* a continuation for the next command to use. 

One final thing to note: a language describes *possible* statements
but an interpreter must be prepared to handle *any* statements, as it
does not know ahead of time what the expression will be.

```haskell
data CursorF k = CursorF
  { insertH :: String -> k
  , deleteH :: Int    -> k
  , retainH :: Int    -> k
  } deriving (Functor)

type Cursor = Cofree CursorF
```



```haskell
type Editor = Cursor (Int, Document)
```

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

```haskell
newEditor :: (Int, Document) -> Editor
newEditor start = coiter next start where
  next w = CursorF (coInsert w) (coDelete w) (coRetain w)
```

```haskell
class (Functor f, Functor g) => Run f g where
  run :: (a -> b -> r) -> f a -> g b -> r
```

```haskell
instance Run ((->) a) ((,) a) where
  run p f = uncurry (p . f)
```

```haskell
instance Run ((,) a) ((->) a) where
  run p f g = p (snd f) (g (fst f))
```

```haskell
instance Run f g => Run (Cofree f) (Free g) where
  run p (a :<  _) (Pure x) = p a x
  run p (_ :< fs) (Free gs) = run (run p) fs gs
```

```haskell
instance Run CursorF OpF where
  run f (CursorF i _ _) (Insert s k) = f (i s) k
  run f (CursorF _ d _) (Delete s k) = f (d s) k
  run f (CursorF _ _ r) (Retain n k) = f (r n) k
```

```haskell
buildDocument :: Operation -> (Int, Document)
buildDocument = editDocument ""
```

```haskell
edit :: Document -> Operation -> (Int, Document)
edit doc ops = run const (newEditor (0, doc)) ops
```

```haskell
test_op_1, test_op_2 :: Operation
test_op_1 = do
  retain 11
  insert "!"
```

```haskell
test_op_2 = do
  delete 1
  insert "L"
  retain 11
```

```haskell
test_edit :: IO ()
test_edit = do
  let doc1 = "lorem ipsum"
  let (_, doc2) = edit doc1 test_op_1
  putStrLn doc2 -- "lorem ipsum!"
  let (_, doc3) = edit doc2 test_op_2
  putStrLn doc3 -- "Lorem ipsum!"
```

```haskell
xform :: Operation -> Operation -> (Operation, Operation)
xform a b = go a b (return (), return ()) wher
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
test_xform :: IO ()
test_xform = do
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
