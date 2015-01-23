---
title: What the fuck is a monad?
lead: "Or: functor? I 'ardly know 'er!"
...

Monads are difficult to explain without sounding either patronizing or
condescending: I would sound patronizing if I came up with some facile analogy
and I would be condescending to describe it categorically.

Instead, I'll frame a problem and piece-by-piece solve the problem with what
will turn out to be a monad.

This post is written in [Typed Racket][typedracket] which you can download for
free at [the Racket website][racket].

# Preliminaries

To make the code a little more pleasing to write and look at I have a standard
syntax extension that I always begin Typed Racket programs with; this is only
here for completeness' sake if you want to execute any of the code:

```scheme
(define-syntax (= stx)
  (syntax-case stx ()
    ((= sym expr)
     #'(define sym expr))
    ((= sym (arg ...) expr)
     #'(define (sym arg ...) expr))))
```

# Put a lid on it

Typed Racket is a functional programming language which heavily discourages
imperative programming styles. Like, for instance, programs of this sort:

```python
def doSomething():
  x = 5
  y = foo()
  return bar(x, y)
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
(= square-then-double (n) (* 2 (*n n)))
```

This is great and all, but how can I perform side effects, capture the
resulting values, and do stuff with them? Composing a long networking program
would be miserable to write in this style.

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
(= list-1 '(1 2 3))
```

Not just every higher-order type is a functor, though. A functor must also
implement some way to *map* pure transformations inside the functor. As a
specific example, I can map the function `(lambda (x) (* x x))` inside a
`Listof Number`s and the result will be a new list with the squares of the
items of the old list.

Perhaps I have a function to determine if a real number is greater than zero:

```scheme
(: gt-zero? (-> Real Boolean))
(= gt-zero? (n) (> n 0))

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
(= boxed-two (Box 2))
(= two (Box-open boxed-two))
```

It doesn't do anything interesting to your value. You can write a simple map
function for `Box` quite easily:

```scheme
(: box-map (All (a b) (-> (-> a b) (Box a) (Box b))))
(= box-map (f bx)
  (Box (f (Box-open bx))))
```

Thus:

```scheme
(= b1 (Box 2))
(= b2 (box-map gt-zero? b1))
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
(: return (All (a) (-> a (Box a))))
(= return (x) (Box x))
```

Why did we call this function `return`? Think about it. Harking back to our
`gt-zero?` function, we can write an upgraded version:

```scheme
(: gt-zero-box? (-> Real (Box Boolean)))
(= gt-zero-box? (n) (return (gt-zero? n)))
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
(: bind (All (a b) (-> (Box a) (-> a (Box b)) (Box b))))
(= bind (ma f) (f (Box-open ma)))
```

Have we solved our problem yet? Let's write a monadic function which subtracts
10 from a number, and then determines if the result is greater than zero:

```scheme
(: sub-10-gt-zero? (-> Real (Box Boolean)))
(= sub-10-gt-zero? (n)
  (bind (return (- n 10)) (λ: ((x : Number))
  (bind (gt-zero-box? x) (λ: ((answer : Boolean))
  (return answer))))))
```

If you squint, and imagine a straightforward syntax transformation, the code
sort of looks like the following:

```scheme
(: sub-10-gt-zero? (-> Real (Box Boolean)))
(= sub-10-gt-zero? (n)
  (:= x (return (- n 10)))
  (:= answer (gt-zero-box? x))
  (return answer))
```

HOLY GODBALLS we just recreated imperative programming. Except it's typesafe,
and all those intermediate local variables are guaranteed not to leak out of
their enclosing scope. Any side-effects created or observed as a result are
safely quarantined inside the monadic function.

# Monad for nothing

`Box`, together with its `return` and `bind` functions, form what is called a
*monad*.

All monads are functors with extra operations defined for them. `List`s, which
we know are functors, are also monads:

```scheme
(: list-return (All (a) (-> a (Listof a))))
(= list-return (x) (cons x '()))

(: flatten (All (a) (-> (Listof (Listof a)) (Listof a))))
(= flatten (xss)
  (foldr (λ: ((y : (Listof a)) (ys : (Listof a))) (append y ys))
           empty xss))

(: list-bind (All (a b) (-> (Listof a) (-> a (Listof b)) (Listof b))))
(= list-bind (ma f)
  (flatten (map f ma)))
```

What does this do? Observe:

```scheme
(: times-5 (-> Number (Listof Number)))
(= times-5 (n)
  (list-bind (list-return (* n 5)) (λ: ((x : Number))
  (list-return x))))

(list-bind '(1 2 3 4 5) times-5)
; => '(5 10 15 20 25)
```

A `List` monad essentially runs an entire list through a function written as if
it were for but one value.

Note that `list-bind` makes use of `map`. In general, a monad will be forced to
make use of its `map` function in one way or another. There are math-y reasons
for this; I won't get into it here.

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
