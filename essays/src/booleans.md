---
title: How to create your own Boolean data types and if-statements ... in Racket!
lead: Or, On the appreciation of conditional love
...

Let's say you had a programming language that didn't support Boolean values, Boolean operators, or `if` syntax natively. What would you do?

Most people would go find another language. Some folks (including yours truly) would maybe adopt a different programming style for that language. But there is a third option:

write your own.

![HEAD EXPLODE](/img/headexplode.gif)

I'm going to demonstrate how to do this in perfectly valid R6RS Scheme (Racket, specifically). Hopefully it will be illuminating.

Creating the data type
===

Racket doesn't have static typing or algebraic data types but we can make pretend like so:

```scheme
(define True (λ () (λ (a b) (a))))
(define False (λ () (λ (a b) (b))))
```

Essentially, `True` is a function which evaluates the first of its two arguments, and `False` is a function which evaluates the second of its two arguments.

So that we can display these values properly, I also define some helper procedures.

```scheme
(define-syntax-rule (displayln str)
  (display (format
    (string-append str "~n"))))

(define (show-bool b)
  (b (λ () (displayln "True"))
     (λ () (displayln "False"))))

(show-bool (True))
; "True"

(show-bool (False))
; "False"
```

Boolean operators
===

So far, so good. But what can we *do* with these values? Why, we can perform Boolean logic! Below I define `and`, `or`, and `not`.

```scheme
(define (and/s p q)
  (p (λ() q) (λ() p)))

(define (or/s p q)
  (p (λ () p) (λ () q)))

(define (not/s b)
  (b False True))

(show-bool (and/s (True) (False)))
(show-bool (and/s (False) (True)))
(show-bool (and/s (True) (True)))
(show-bool (or/s (False) (True)))
(show-bool (or/s (True) (False)))
(show-bool (or/s (False) (False)))
(show-bool (not/s (and/s (False) (True))))
```

`if` expressions
===

Ah, the part you've all been waiting for. First the code, then the explanation:

```scheme
(define-syntax-rule (if/g condition then else)
  (let ((then-f (λ () then))
        (else-f (λ () else)))
    (condition then-f else-f)))

(if/g (True)
  (displayln "Condition was true")
  (displayln "Condition was false"))

; "Condition was true"

(if/g (False)
  (displayln "Condition was true")
  (displayln "Condition was false"))

; "Condition was false
```

`if/g` is defined as a macro because of how Scheme evaluates expressions. In normal functions, all arguments are evaluated before the function's value is computed.

In the case of an `if` conditional, though, the entire reason you want to use it is so that you can *not* evaluate certain expressions under certain conditions.

The solution to this is to write a *macro*. A macro is a procedure run during code compilation which does **not** evaluate its arguments by default. Instead, it returns a form which is literally pasted in place of the macro call, and the arguments are the unevaluated expressions it received, not their values.

So `functions` run at runtime, and `macros` run at compile time. Scheme provides an elegant mechanism for creating simple macros called `define-syntax-rule`. There are more complex but powerful ways to do this, with their own tradeoffs.

See if you can figure out why this macro is correct given what I have just told you.

Epilogue
===

So you don't really need conditionals baked into your language. A question, though, is how expensive are these operations?

In a language like C, you can just use 1 or 0, which is stored compactly and efficiently, and you can simulate Boolean algebra with arithmetic algebra. Eg, `True AND False` <=> `1 * 0`.

With our method, a naive compiler would generate rather horrible code. However, if you think about it, a Boolean expression is a series of function applications which can theoretically be optimized extensively, and the data types themselves aren't so much actual data but control flow mechanisms themselves.

So, no concrete answer but this doesn't have to be a death sentence to efficiency.
