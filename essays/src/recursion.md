---
title: Recursion
...

For more information, see also [this enlightening post on recursion][fuckyou]

It's fucking weird. It's also the crucial property of a language that makes it
*Turing-complete* (that is, powerful enough to compute anything which can be
computed). [^1] It's often baked into a language and while it works it makes no
sense intuitively.

So, we are going to pretend the Scheme language **doesn't** have recursion, and
**create it ourselves**. Our goal will be to write a factorial function
which works while not referring to itself.

![Fuck it, we'll do it live](http://i.ytimg.com/vi/eUFY8Zw0Bag/hqdefault.jpg)

For reference, here is the procedure we are trying to emulate [^2]:

```scheme
(define fact
  (lambda (n)
    (if (zero? n)
        1
        (* n (fact (- n 1))))))
```

Let's go
===

Without recursion, we have the following hole in our logic:

```scheme
(define fact
  (lambda (n)
    (if (zero? n)
        1
        (* n ( <???> (- n 1))))))
```

Since we can't call `fact` (as it hasn't been defined yet), what can we do?

What if - and please bear with me - somehow we were able to *give* `fact` the
next function it should call? Like this:

```scheme
(define fact-sort-of
  (lambda (call-me-next)
    (lambda (n)
      (if (zero? n)
          1
          (* n (call-me-next (- n 1)))))))
```

`fact` is a function which returns *another* anonymous function with an
argument `call-me-next`, which otherwise wraps our original function. Well,
what if you were able to do something like this:

```scheme
(let ((k (fact-sort-of)))
  ((k k) 5))
```

That is to say, what if you could get that anonymous function from `fact` and
then apply it to itself?

The universe is a snake beating itself
===

We want to automate the process of applying a function to itself, returning the
composition of the two functions and saving the galaxy from the bug invaders.

Things we know:

1. This recursion-maker-function-thing will accept one argument, the function
to be fucked with.

2. It will return the application of a function to itself.

Let's sketch something:

```scheme
(define function-fucker
  (lambda (F)
    (F F)))

(define fact (function-fucker fact-sort-of))
(fact 5)
```

When I run this, it tells me I'm a huge loser who will never find true love.
But why?

`F` and `fact-sort-of` are functions which accept other functions as arguments.
They return ... functions which accept other functions as arguments. Passing in
`5` just isn't going to cut it.

Time is a cat circle
===

Let's back up and think much more simply. `fact-sort-of` returns a function
which accepts a function, and we know that the one it accepts is going to be
itself. Make your goddamn *Inception* jokes now, if you must.

- Our goal is to write a factorial function that receives itself as an argument
instead of referring to its own name.

- We know that since this argument is itself, and *it* needs to be fed itself
  to work, that this argument is going to have to be fed to itself.

- Thus, we define the correct function, and then we define it *again* as an
  *argument* to the first one.

```scheme
(define fact-sort-of
  ((lambda (call-me-maybe)
     (lambda (n)
       (if (zero? n)
           1
           (* n ((call-me-maybe call-me-maybe) (- n 1))))))
   (lambda (call-me-maybe)
     (lambda (n)
       (if (zero? n)
           1
           (* n ((call-me-maybe call-me-maybe) (- n 1))))))))

(fact-sort-of 5)
```

HOLY JUMPING JEHOSEPHAT it worked. *It worked!* **IT WORKED.**

... why, again?


Imagine that the `lambda` calls were replaced with `foo`. Then the thing looks
like this:

```scheme
(define fact-sort-of
  (lambda (call-me-maybe)
    (foo foo)))
```

Okay, so this worked. But as wise men once said,

> Our work is never over
>
> <cite>Daft Punk</cite>

I hate you so fucking much Gatlin
===

So how do we write a general function-fucker that works for any
(single-argument) function? Let's abstract our general technique:

```scheme
(define function-fucker
  (lambda (target)
    ((lambda (f) ...)
     (lambda (f) ...))))
```

`target` is a function which wishes to receive itself so that it can begin
autophagia. The two `lambda` expressions are going to be identical, though, so
figuring out one means figuring out the other.

Indeed, the `lambda`s are *also* functions which expect to be given themselves
as their next move, with the understanding that the first will receive the
second as an argument **OH MY GOD I'M CROSS EYED**

The whole fucking point of this is to turn the `target` into a recursive
function, so we may as well cut the foreplay and call it:

```scheme
(define function-fucker
  (lambda (target)
    ((lambda (f)
       (target ...)))
     (lambda (f)
       (target ...))))
```

So far, so good. Resisting the tempation to replace the ellipses with `target`
and be mocked again by the cruel lifetime of loneliness ahead, what should we
give it?

It wants to receive a function it can call when it's ready to call itself. The
*itself* part expects to receive the actual function argument and do something
with it. Let's add this:

```scheme
(define function-fucker
  (lambda (target)
    ((lambda (f)
       (target (lambda (arg) ...)))
     (lambda (f)
       (target (lambda (arg) ...))))))
```

And what should *that* inner function do with its argument? Why, it should use
`f`, the roundabout reference back to `target`, to --

**HOLD IT RIGHT THERE DON'T YOU FUCKING DARE GIVE `arg` TO `f`**

`f` is a function expecting another function. It will not accept a number. FUCK
WHEN DOES THIS END

wait wait wait didn't we tie the knot earlier, so-to-speak, by passing
`call-me-maybe` to itself?

VIOLA!
===

![VIOLA](http://www.musicwithease.com/viola-iS-2.jpg)

```scheme
(define function-fucker
  (lambda (target)
    ((lambda (f)
       (target (lambda (arg) ((f f) arg))))
     (lambda (f)
       (target (lambda (arg) ((f f) arg)))))))

(define fact-sort-of
  (lambda (k)
    (lambda (n)
      (if (zero? n)
          1
          (* n (k (- n 1)))))))

(define fact (function-fucker fact-sort-of))

(fact 5)
```

We get `120`, as expected. Let's walk through what happens when we fuck the
function:

```scheme
(function-fucker fact-sort-of) ; =>

((lambda (target)
   ((lambda (f)
      (target (lambda (arg) ((f f) arg))))
    (lambda (f)
      (target (lambda (arg) ((f f) arg))))))
 fact-sort-of)

; =>

((lambda (f)
   (fact-sort-of (lambda (arg) ((f f) arg))))
 (lambda (f)
   (fact-sort-of (lambda (arg) ((f f) arg)))))

; =>

(fact-sort-of
  (lambda (arg)
    ((lambda (f)
       (fact-sort-of (lambda (arg) ((f f) arg))))
     (lambda (f)
       (fact-sort-of (lambda (arg) ((f f) arg)))))))

; =>

(lambda (n)
  (if (zero? n)
      1
      (* n
         ((lambda (arg)
            ((lambda (f)
               (fact-sort-of (lambda (arg) ((f f) arg))))
             (lambda (f)
               (fact-sort-of (lambda (arg) ((f f) arg))))))
          (- n 1)))))

; => ...
```

And that's what the body of `fact-sort-of` becomes.

`function-fucker` has an actual name. A fellow named [Haskell Curry][curry]
drummed it up, and it's called the **Y combinator** ("combinator" is a fancy
word for "function with one argument you ignorant pigfucker").

Its name derives from the two identical lambda functions. Cute, huh?

xoxo Gatlin <gatlin@niltag.net>

[^1]: An equivalent property is to be able to write looping procedures which
last an arbitrary number of iterations.

[^2]: This will blow up the stack and fail miserably on even moderately large
numbers. It is purely for pedagogical purposes.

[fuckyou]: http://niltag.net/essays/recursion.html
[curry]: http://en.wikipedia.org/wiki/Fixed-point_combinator
