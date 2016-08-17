---
title: Operational Transformation in Haskell, Part 1
lead: Or, Watch Your Language!
...

Recently for a client project I've been studying
[operational transformation][otwiki], which sounds significantly more sci-fi
than it actually is.

If you aren't familiar with OT, the premise is this: if you and I are editing a
document in real time then we can't just keep sending up our drafts to the
server because we'll overwrite each other (and also not get each others'
changes). Instead, we send up *operations*.

But if you and I send up, say, edits `A` and `B` (respectively) to a server and
the server arbitrarily applies mine first, it can't simply apply `B` next. `B`
was an edit to an earlier version of the document and it may not make sense
anymore.

While real-time collaborative editing has a lot of moving parts, the heart of it
is a *transformation* algorithm which, in the scenario described above,
transforms `B` into something which *can* be applied after `A`.

I decided I wanted to implement this transformation algorithm myself to better
understand how it works, but for this to be meaningful (and to know if it
actually worked) I need to first come up with a way to represent documents and
edits, and apply said edits to said documents.

**Thus** this first article will explain how I created a domain specific
language (DSL) for document operations as well as an accompanying interpreter
which computes a new document from an original, based on the operations. The
techniques used here give me several nice things:

1. My DSL takes advantage of Haskell's type checker automatically;
2. The syntax of the language is separate from the semantics, meaning I may
   write several different interpreters for the same language; and
3. Because of that separation it's easy to transform the `Operation`
   expressions before ever caring what they do.

You can view the entire [code listing here][otgist] and play along at home!

# Free falling

In OT, there are three kinds of edits: insertions, deletions, and skips (also
called "retains"), and those will be the three commands in our operation
language.

OT assumes that you have a document and a cursor at some position in that
document. Insertion, uh, inserts characters and moves the cursor
forward. Deletion keeps the cursor still but deletes some number of characters
after the cursor. Retaining just skips the cursor ahead without affecting the
document.

For our purposes, we can define documents like so:

```haskell
type Document = String
```

This makes the type signatures a little bit more expressive.

The [`free package`][freepkg] on Hackage defines what is called the
*free monad*. If you're not comfortable with the term "monad" that's actually
great. What you need to know is: monads define imperative languages and side
effects they may perform, and how they may perform them.

The `Free` type exported from this package is the common structure of all monads
distilled into a "just add water" data type. All you have to do is provide the
grammar of the language you want to create.

Here is what `Free` looks like, with some naming changes to make it more
intuitive:

```haskell
data Free f a
    = Done a
    | More (f (Free f a))
```

At heart, all monads define either a finished computation of some value `a`, or
declare there is more to be done. That's really it. The `f` represents your
grammar, limiting how expressions in your language interact with one another. 

Without further ado, then, here is our `Operation` language:

```haskell
data OperationGrammar k
    = Insert String k
    | Delete Int    k
    | Retain Int    k
    deriving (Show, Functor)

type Operation = Free OperationGrammar ()

insert :: String -> Operation
insert str = liftF $ Insert str ()

delete :: Int -> Operation
delete n = liftF $ Delete n ()

retain :: Int -> Operation
retain n = liftF $ Retain n ()
```

And with that you have created an embedded language. You can define operations
like so:

```haskell
my_first_op :: Operation
my_first_op = do
    delete 6
    insert "Hello World"
```

Note the definition of `Operation`. Monads *in general* are computations of some
base type and the result of the computation may often be important. In our case
however the language is *only* useful for its side effects. Because of this we
can safely "plug the hole" with `()`.

# A cursory overview

We have said that operations essentially dictate how to edit a document at a
given cursor position, which may result in changes to both the document and the
cursor position.

Thus we will say that an *operation* is interpreted by a *cursor* representing a
document and a position.

Just as there is a `Free` monad there is a `Cofree` comonad. Calm down. Breathe.

Monads define languages with side effects and comonads define interpreters with
internal environments. That's really it.

The `Cofree` definition is this:

```haskell
data Cofree f a = a :< f (Cofree f a)
```

You can think of `a` as the internal state of the comonad. At any given point in
a comonad computation you are in a state and you have the possibility of moving
to a different state. In the case of cofree comonads, your options are defined
by - you guessed it - some functor type.

We want an interpreter which can process the `OperationGrammar` commands we
wrote. So, here goes:

```haskell
data CursorF k = CursorF
    { insertH :: String -> k
    , deleteH :: Int    -> k
    , retainH :: Int    -> k
    } deriving (Functor)
type Cursor a = Cofree CursorF a
```

A `Cursor a` is an interpreter which modifies an internal value of type `a`
using one of three different handler functions. The handlers will accept the
arguments from their corresponding operations and then produce (ultimately) a
new `Cursor a`. The `Cofree` type handles tying all the particular knots.

Now, we might want different kinds of interpreters for different situations. One
might pretty-print `Operation` expressions to a log. One might apply them to a
document. One might send them over the network and then apply edits from *other
people* first.

We want a document editor, specifically, which keeps track of a document string
and a cursor position. So let's define it:

```haskell
type Editor = Cursor (Int, Document)
```

Now we need to create an `Editor`. The `free` package provides the `coiter`
function, which is a bit of an opaque name. However, refer back to the `Cofree`
definition. A cofree comonad at all times has a current internal value and a way
to get to a "next" value. This makes it a bit like a stream of values that lets
you pick which branch you want to explore. `coiter` is a way of building a
comonad stream in a way that is not nearly as complicated as it sounds.

Let's start at the top level:

```haskell
newEditor :: (Int, Document) -> Editor
newEditor start = coiter next start where
    next w = CursorF
                (coInsert w)
                (coDelete w)
                (coRetain w)
```

We provide a starting state (most likely `(0, "")` but it could be anything) and
a function `next` which takes a cofree comonad and produces an interpreter value
that contains the next comonad. I know, I know. Let it sink in.

Let's define these auxiliary functions.

```haskell
coInsert :: (Int, Document) -> String -> (Int, Document)
coInsert (idx, doc) str = (idx', doc') where
    idx' = idx + length str
    doc' = pre ++ str ++ post
    (pre, post) = splitAt idx doc
```

(We get `splitAt` from `Data.List` in the base libraries.)

`coInsert` accepts a state value (in this case, `(Int, Document)`) and a string
to insert, and produces a *new* state value. That's really it. This really
showcases the elegance of the (co)free approach to DSLs: the behavior of a
command is defined separately from the declaration of the command, and indeed it
may not be the only behavior.

`coDelete` and `coRetain` are similar:

```haskell
coDelete :: (Int, Document) -> Int -> (Int, Document)
coDelete (idx, doc) n = (idx, doc') where
    doc' = pre ++ (drop n post)
    (pre,post) = splitAt idx doc
    
coRetain :: (Int, Document) -> Int -> (Int, Document)
coRetain (idx, doc) n = (idx+n, doc)
```

And with that, we can create a new `Editor` with `newEditor (0, "")` and
... well, actually, we still need to feed `Operation`s into the `Editor` to get
the result document. Hm.

# Run away!!!

We have a grammar for document operations and an interpreter for those
operations and how they affect a document and cursor position. We need to define
how these may be combined.

The tricky thing is, the language and interpreter are each composites of two
types. The `Free` layer of an operation tells the `Cofree` layer of the
interpreter whether to keep going or yield the latest state value; and
`OperationGrammar` dictates which `CursorF` function will be used to modify the
state value.

The following type class, with a different name, is stolen from
[David Laing][laing]:

```haskell
class (Functor f, Functor g) => Run f g where
    run :: (a -> b -> r) -> f a -> g b -> r
```

The `run` method will accept the final monad and comonad computations as well as
a function saying what to do with them.

We will define instances for both `Cofree`/`Free` and
`CursorF`/`OperationGrammar` and let the compiler decide what we mean when we
say `run`.

```haskell
instance Run f g => Run (Cofree f) (Free g) where
    run p (a :<  _) (Pure x) = p a x
    run p (_ :< fs) (Free gs) = run (run p) fs gs

instance Run CursorF OperationGrammar where
    run f (CursorF i _ _) (Insert s k) = f (i s) k
    run f (CursorF _ d _) (Delete n k) = f (d n) k
    run f (CursorF _ _ r) (Retain n k) = f (r n) k
```

The idea behind all three is we give the operation argument to the appropriate
handler, which will produce the correct next `Cursor`. Both that and the next
`Operation` are then given to `f`.

With this we may define the `edit` function to transform a `Document` with an
`Operation`:

```haskell
edit :: Document -> Operation -> (Int, Document)
edit doc ops = run const (newEditor (0, doc)) ops
```

Since the base value of every `Operation` is `()` we use `const` to basically
throw away the monadic result.

# Let's try it out!

```haskell
opA :: Operation
opA = do
    delete 1
    insert "H"
    retain 10

editor_test :: IO ()
editor_test = do
    let doc = "hello world"
    let (result_length, doc') = edit doc opA
    putStrLn doc'
    -- "Hello world"
```

And there you have it! We created a language for document operations and an
interpreter which could actually transform documents with it.

My next article will show how to actually do the OT part of this. Until then!

[freepkg]: http://hackage.haskell.org/package/free
[otwiki]: https://en.wikipedia.org/wiki/Operational_transformation
[laing]: http://dlaing.org/cofun/posts/free_and_cofree.html
[otgist]: https://gist.github.com/gatlin/1bf02fa50e02a481f7142dd87fe2711f
