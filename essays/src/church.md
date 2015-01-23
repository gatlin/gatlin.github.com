---
title: Lambda calculus and Church numerals
lead: Or, DIY arithmetic
...

Lambda calculus is a system for expressing computation. It is a formal language
with a few simple constructs capable of expressing any computation that can be
expressed.

This post will introduce the lambda calculus and motivate why it is so powerful.

We will use the [Racket](http://racket-lang.org) programming language for some
code snippets. Racket is a friendly yet powerful language which closely
resembles lambda calculus; and the [download](http://racket-lang.org/download/)
comes with the friendly yet powerful Dr Racket environment for programming.

You can copy the code snippets into Dr Racket and play around with them. Try it!

Abstraction and application
===

Lambda calculus is a language for expressing computation. In math notation, a
function which takes some argument `x` and returns `x + 1` looks like this:

```scheme
λ x . x + 1
```

This is called *abstraction*: we have created a function which abstracts some
operation. If we named this function `f`, for example, we could *apply* it like
so:

```scheme
    (f 1)
```

Which would yield 2. There's one problem with this, though: in lambda calculus
**everything is a function.**

DROP THE BASS

So, strictly speaking, in the pure lambda calculus you wouldn't be able to
write `x + 1` without first defining what plus and 1 are. However, if you
*could* define arithmetic using only the lambda calculus, you'd be able to
define literally anything.

Let's give it a shot.

Baby's first arithmetic isomorphism
===

Here's Racket code for defining a function `zero` and a function `succ` (for successor):

```scheme
; zero is a function
(define zero (λ (f)
  (λ (x)
    x)))

; succ ("successor") is also a function
(define succ (λ (n)
  (λ (f)
    (λ (x)
      (f ((n f) x))))))
```

How the hell do I read this? Let's break it down:

We define `zero` to be a function which accepts an argument `f` which returns
... a function which accepts an argument `x` which returns `x`, untouched.

`succ` is defined as a function with an argument `n` which returns ... a
function with an argument `f` which returns ... a function with an argument `x`
which returns (`f` applied to (`n` applied to `f`)) applied to `x`.

It's all confusing, I know. I'll try to type more slowly.

How are these functions equivalent to zero and "plus 1?" Perhaps if we can
define some translation between them something more intuitive then it will make
more sense.

Okay:

```scheme
(define (church->number n) ((n add1) 0))
```

This defines `church->number` to be a function which accepts an argument `n`
(in this case, our function-number-thing), applies it to a real-world function
called `add1`, and then applies the resulting function to 0. `add1` is a
function in Racket which adds 1 to its argument.

Why do I call it `church->number`? Because the lambda calculus was conceived by
a fellow named Alonzo Church. He's awesome.

Let's be sure `church->number` does what we think it will and apply it to `zero`:

```scheme
(church->number zero) => ((zero add1) 0) => (((λ (f) (λ (x) x)) add1) 0) => 
((λ (x) x) 0) => 0
```

Okay, it works for zero. Let's create a `one` and test it. Here are both an
explicit definition of `one` and a `one` created from `(succ zero)`:

```scheme
; These two definitions of `one` are equivalent
(define one-manual (λ (f)
  (λ (x)
    (f x))))

(define one-computed (succ zero))
```

`one` is a function which accepts an argument `f` and returns ... a function
which accepts an argument `x` and returns ... `f` applied to `x`. Let's verify
this is 1 with our `church->number` function:

```scheme
(church->number one-manual) => ((one-manual add1) 0) => (((λ (f) (λ (x) (f x))) add1) 0) =>
((λ (x) (add1 x)) 0) => (add1 0) => 1.
```

Indeed, applying `church->number` to both `one-manual` and `one-computed` yields 1, as expected.

The structure of our Church numbers becomes more clear: Inside the body of the
function, `f` is the `add1` function; for `zero` it is applied to `x` 0 times,
and for `one` it is applied 1 time. And `x` is just 0.

![I see what you did there.](http://zanyjaney.com/wp-content/uploads/2012/09/1656-462x600.jpg)

Addition and multiplication
===

Now that we have `zero`, a successor function, and a means of converting the
lambda calculus value to more friendly representations of numbers, we can
define addition and multiplication:

```scheme
(define add (λ (n)
  (λ (m)
    (λ (f)
      (λ (x)
        ((n f) ((m f) x)))))))

(define mult (λ (n)
  (λ (m)
    (λ (f)
      (n (m f))))))
```

Basically, giving two church numbers to `add` yields a function which accepts
an argument `f` returning a function accepting an argument `x` returning the
Church sum of the first two arguments. But how?

Let's play it out:

```scheme
(add one-manual one-computed)

;=>

(((λ (n) (λ (m) (λ (f) (λ (x) ((n f) ((m f) x)))))) ; add
 (λ (f) (λ (x) (f x)))) ; one-manual
 (λ (f) (λ (x) (f x)))) ; one-computed

;=>

(λ (f)
  (λ (x)
    (((λ (f) (λ (x) (f x))) f)
     (((λ (f) (λ (x) (f x))) f) x))))

;=> all `f`s are the same

(λ (f)
  (λ (x)
    ((λ (x) (f x))
     ((λ (x) (f x)) x))))

;=>

(λ (f)
  (λ (x)
    (f ((λ (x) (f x)) x))))

;=>

(λ (f)
  (λ (x)
    (f (f x))))
```

What does this equal?

```scheme
(church->number (λ (f) (λ (x) (f (f x))))) => ((λ (f) (λ (x) (f (f x)))) add1) 0 =>
(add1 (add1 0)) => 2
```

HELL YEAH

I'll leave it as an exercise to the reader to figure out how `mult` works :)

What was the point again?
===

We have provided some intuition for how to define arithmetic in the lambda
calculus. If I can add, I can subtract; if I can multiply, I can divide; if I
can add and multiply I can use exponents; if I have exponents, I have
logarithms; if I have all those things I can compute limits; if I have limits,
I can compute derivatives ... and we're at regular college calculus.

All with lambda abstraction and lambda application.

There are several consequences of this power, however:

1. Because lambda calculus is as expressive as arithmetic, it runs afoul of
both Incompleteness Theorems. Look 'em up, it's fascinating.

2. Because of the incompleteness theorem, programs written with the lambda
calculus have the Halting problem: a program which reads programs and
determines if they halt, will not be able to read itself and decide if it
halts. This has very important consequences.

At this point I could go down a bunch of fascinating rabbit holes but I've
probably used up more than enough of your time. Hopefully this sheds some
insight on how computer science actually "works."

