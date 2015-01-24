---
title: What the fuck is a monad?
lead: "Or: drinking alone isn't healthy"
...

Monads are difficult to explain without sounding either patronizing or
condescending: I would sound patronizing if I came up with some facile analogy
and I would be condescending to describe it categorically.

Instead, I'll frame a problem and piece-by-piece solve the problem with what
will turn out to be a monad.

This post is written in [Typed Racket][typedracket] which you can download for
free at [the Racket website][racket].

# Take me to functor town

Typed Racket is a functional programming language which heavily discourages
imperative programming styles. Like, for instance, programs of this sort:

```python
def doSomething():
  x = 5
  y = foo()
  x = bar(10, y)
  return x
```

Here we have three imperative statements modifying some state. Functional
languages would prefer that state didn't exist. At least, not the Wild West,
anything-goes,
no-guarantees-whatsoever-about-who-is-accessing-what-free-love-festival that is
the typical understanding.

Imperative programming makes use of *side-effects*: I may write code which
alters a database, or reads the time, or has some other side-effect on the
state of the machine or surrounding world. Every time I query a network time
server I get a different response, meaning that the result is dependent on
mutation of state.

Hell, even just storing the result of a pure computation in a value for use at
a later time is relying on the side effect of storing values in memory.

On the other hand, pure functional programming requires you to sequence actions
through function composition:

```scheme
(: square-then-double (-> Real Real))
(define (square-then-double n) (* 2 (*n n)))
```

This is great and all, but how can I recapture the (admitted) simplicity of
that python snippet? Maybe this way:

```scheme
(let ((x 5)
      (y (foo)))
  (let ((x (bar 10 y)))
    x))
```

But that becomes unwieldly after a while.
 
Correct imperative programs are written every day so there must be some way of
representing them in a principled manner which can catch type and other logic
errors.

# What the functor ... ?

Let's take a side-step to introduce a fundamental concept in type theory. It's
called the *Functor*. A functor is a *higher-order* type; it depends on some
*base* type for its full meaning. For instance, in Typed Racket `Listof` is a
higher-order type: you can have `Listof Number` or `Listof String` or `Listof
Boolean`.

```scheme
(: list-1 (Listof Number))
(define list-1 '(1 2 3))
```

Not just every higher-order type is a functor, though. A functor must also
implement some way to *map* pure transformations inside the functor. As a
specific example, I can map the function `(lambda (x) (* x x))` inside a
`Listof Number`s and the result will be a new list with the squares of the
items of the old list.

Perhaps I have a function to determine if a real number is greater than zero:

```scheme
(: gt-zero? (-> Real Boolean))
(define (gt-zero? n) (> n 0))

(map gt-zero? list-1)
; => '(#t #t #t)
```

This is a function from `Real` numbers to `Boolean` values. Mapping `gt-zero?`
over a `Listof Number`s yields a `Listof Boolean`s. Lists are definitely
functors since their map function is actually called `map`.

There are other kinds of functors. The simplest functor is what I like to call
`Box`. It may be defined in Typed Racket as follows:

```scheme
(struct: (a) Box ((open : a)))
```

A `Box` just contains some base value and lets you retrieve it later, like so:

```scheme
(define boxed-two (Box 2))
(define two (Box-open boxed-two))
```

It doesn't do anything interesting to your value. You can write a simple map
function for `Box` quite easily:

```scheme
(: box-map (All (a b) (-> (-> a b) (Box a) (Box b))))
(define (box-map f bx)
  (Box (f (Box-open bx))))
```

Thus:

```scheme
(define b1 (Box 2))
(define b2 (box-map gt-zero? b1))
```

produces `Box 2` and `Box #t`.

# We're in a bind ...

A `Box` is a simple context around a base value. A function expecting a
`Number` argument won't accept a `Box Number` argument, however we can project
or map functions with `Number` arguments into a `Box Number`. And after we map
that operation we can retrieve the resulting pure value.

An imperative, side-effect-ful function is one in which we have some kind of
workspace or context in which we may do crazy shit and then, at the end,
retrieve a pure value. We know how to take values out of a context, and we also
know how to put them in (at least, when that context is `Box`):

```scheme
(: box-return (All (a) (-> a (Box a))))
(define (box-return x) (Box x))
```

Why did we call this function `return`? Think about its use in Python. That's a
clue. In the meantime, let's write a box-y version of `gt-zero?`:

```scheme
(: gt-zero-box? (-> Real (Box Boolean)))
(define (gt-zero-box? n) (return (gt-zero? n)))
```

The base type changed *and* the value was put inside a `Box`. Given arguments
of a pure value I can perform some operation inside a `Box` context and return
to you that context, and you would be free to extract the pure value at any
time. And when I say `Box` I really mean any `monad` but shh we're getting
there.

But normal functions, like `filter` or `sum` on lists, compose. I can write `(f
(g x))` provided that `g`'s output matches `f`'s input. Can I compose these
`monadic` functions of type `(All (a b) (-> a (Box b)))`?

Sure you can! First let's think about the type. The result of some monadic
function from `a` to `b` would have the above type, and then another function
might have `(All (b c) (-> b (Box c)))`. So ultimately we want to extract
values from one context, feed them into a monadic continuation, and get the
resulting monadic value.

It's called `bind`:

```scheme
(: box-bind (All (a b) (-> (Box a) (-> a (Box b)) (Box b))))
(define (box-bind ma f) (f (Box-open ma)))
```

Have we solved our problem yet? Let's write a monadic function which subtracts
10 from a number, and then determines if the result is greater than zero:

```scheme
(: sub-10-gt-zero? (-> Real (Box Boolean)))
(define (sub-10-gt-zero? n)
  (box-bind (box-return (- n 10)) (λ: ((x : Number))
  (box-bind (gt-zero-box? x) (λ: ((answer : Boolean))
  (box-return answer))))))
```

If you squint, this sort of looks like we are binding `(return (- n 10))` to
the variable `x` like in an imperative language.

Let's write a syntax-extension to do just this **warning: you can ignore this
next snippet; I'm only providing it to prove it is possible**:

```scheme
(define-syntax do^
  (syntax-rules (:= let)
    ((_ (:= v e) e2 es ...)
     (bind e (lambda (v) (do^ e2 es ...))))
    ((_ (let [v e] ...) e2 es ...)
     (let ((v e) ...)
       (do^ e2 es ...)))
    ((_ e e2 es ...) (bind e (lambda (_) (do^ e2 es ...))))
    ((_ e) e)))

(define-syntax (do stx)
  (syntax-case stx ()
    ((_ prefix e1 e2 ...)
     (with-syntax ((prefix-bind (format-id #'prefix "~a-bind" #'prefix))
                   (prefix-return (format-id #'return "~a-return" #'prefix)))
       #'(syntax-parameterize ((bind (make-rename-transformer #'prefix-bind))
                               (return (make-rename-transformer #'prefix-return)))
                              (do^ e1 e2 ...))))))
```

*Thanks to user chandler on the #racket IRC room for teaching me how to do this.*

So now this is legal:

```scheme
(: sub-10-gt-zero? (-> Real (Box Boolean)))
(define (sub-10-gt-zero? n)
  (do box
    (:= x (return (- n 10)))
    (:= answer (gt-zero-box? x))
    (return answer)))
```

HOLY GODBALLS we just recreated imperative programming. Except it's typesafe,
and all those intermediate local variables are guaranteed not to leak out of
their enclosing scope. Any side-effects created or observed as a result are
safely quarantined inside the monadic function.

# Monad for nothing

`Box`, together with its `return` and `bind` functions, form what is called a
*monad*. `Box` recreates the imperative programming style we miss from other
languages, but it is literally the simplest functor to base a monad on. Using
other functors we can go beyond merely being able to write sequential actions
to other more advanced forms of flow control - and still write it imperatively.

Say I have a function which transforms a number and I want to run this
transformation over a list of numbers. I can base a monad off of the `List`
functor like so:

```scheme
(: list-return (All (a) (-> a (Listof a))))
(define (list-return x) (cons x '()))

; this is the same as (list x), but I wanted to show what it is doing

(: flatten (All (a) (-> (Listof (Listof a)) (Listof a))))
(define (flatten xss)
  (foldr (λ: ((y : (Listof a)) (ys : (Listof a))) (append y ys))
           empty xss))

(: list-bind (All (a b) (-> (Listof a) (-> a (Listof b)) (Listof b))))
(define (list-bind ma f)
  (flatten (map f ma)))
```

With this in hand, I can write a nice procedural function which multiplies a
single number by 5:

```scheme
(: times-5 (-> Number (Listof Number)))
(define (times-5 n)
  (do list
    (let [n (* n 5)])
    (return n)))
```

And yet, when I run it on a list, it iterates over the entire list for me:

```scheme
(list-bind '(1 2 3 4 5) times-5)
; => '(5 10 15 20 25)
```

While this may seem a bit overwhelming, remember this only needs to be done
once .. and it was just done.

Note that `list-bind` makes use of `map`. In fact, while you can write `bind`
functions without directly using `map`, the classical definition of a monad was
a triple of functions called `map`, `return`, and *join*.

`join` has the type (when dealing with `Box`es) of `(All (a) (-> (Box (Box a))
(Box a)))`. We have already seen a function with this signature: `flatten`, for
`List`s.

`join` is really just `flatten` for monads which aren't `List`s. Given a
suitable definition of `join`, `bind` may always be defined as such:

```scheme
(: bind (All (a) (-> (M a) (-> a (M b)) (M b))))
(define (bind mma) (join (map f mma)))
```

This is exactly how we defined `list-bind` above. However, anecdotally, most of
the time `join`'s only purpose is to define `bind` so I started with that. So
shoot me.

# Conclusion

Monads are not a difficult concept: they are contexts inside of which pure
values may create and react to side-effects in the course of computing some
final value.

Depending on the implementation of two functions - called `return` and `bind` -
the same imperative style of programming can take on different operational
meanings.

How could you create a monad which terminates early if an error value is
returned at any point? You can figure it out.

[typedracket]: http://docs.racket-lang.org/ts-guide/index.html
[racket]: http://racket-lang.org
