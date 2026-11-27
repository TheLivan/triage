# PVS-Studio Java — General Analysis and OWASP

Rule summaries for General Analysis (V6001–V6136) and OWASP (V5301–V5343) from the [PVS-Studio catalog](https://pvs-studio.com/en/docs/warnings/).

## V6001

Identical operands of an operator suggest a typo or copy-paste error.

## V6002

A switch statement does not cover all values of an enum.

## V6003

The same condition guards both an if branch and a following else-if branch.

## V6004

The then and else branches of a conditional perform equivalent actions.

## V6005

A variable is assigned to itself.

## V6006

An object is constructed and discarded. For an exception, check whether the constructor call was meant to follow `throw`.

## V6007

An expression always evaluates to the same truth value.

## V6008

A reference may be null when dereferenced. Trace the path past guards and check the return contract of the method that supplied the reference.

## V6009

A function receives an argument that looks wrong for its contract.

## V6010

A method result is discarded even though the caller may need it.

## V6011

An integer intermediate can lose precision before it is used in a floating-point expression.

## V6012

A ternary operator returns the same value regardless of its condition.

## V6013

A comparison of strings, arrays, or collections tests reference identity. Check whether the code compares against a sentinel or guarantees that both strings are interned.

## V6014

A method always returns the same constant.

## V6015

An expression probably meant to use !=, +=, or -= instead of the written operator.

## V6016

A loop body accesses the same constant index on every iteration.

## V6017

The counter of an outer loop is not used inside the nested loop.

## V6018

A switch statement tests a constant expression.

## V6019

A statement cannot be reached.

## V6020

A divisor may be zero in a division or remainder expression.

## V6021

An assigned value is never read afterwards.

## V6022

A method parameter is never used in the body.

## V6023

A parameter is always overwritten before its first use.

## V6024

A continue statement terminates a do-while(false) loop unconditionally.

## V6025

An index may lie outside the collection bounds.

## V6026

A value is assigned that the variable already holds.

## V6027

Two variables are initialized with the result of the same call.

## V6028

A compound assignment applies the same expression to both sides.

## V6029

Arguments passed to a method may be swapped.

## V6030

The right operand of a bitwise & or | on booleans is evaluated unconditionally.

## V6031

The same variable serves as the counter of both an outer loop and a nested loop.

## V6032

Two method bodies are fully equivalent.

## V6033

A collection may receive a key it already contains.

## V6034

A shift count is inconsistent with the width of the shifted type.

## V6035

Two logical negations cancel each other. For a boxed Boolean, `!!value` still unboxes the reference and can throw if it is null.

## V6036

A value is read from an Optional that may not be present.

## V6037

A loop body contains an unconditional break, continue, or return.

## V6038

A value is compared against Double.NaN with == or !=.

## V6039

A second if repeats the condition of an earlier if that always returns.

## V6040

The code's runtime logic does not match its indentation.

## V6041

An assignment hides inside the condition of an if or while statement.

## V6042

A value is checked for compatibility with one type but cast to another.

## V6043

The initial and final values of a loop iterator are the same.

## V6044

A postfix increment or decrement is discarded because the variable is overwritten.

## V6045

A sequence of similar comparisons contains a repeated or suspicious subexpression.

## V6046

Format specifiers and supplied arguments may disagree in count or type.

## V6047

An else branch may belong to the previous if statement.

## V6048

An expression can be simplified because one operand equals a constant.

## V6049

A class defines equals without hashCode.

## V6050

Class initializers may form a cycle.

## V6051

A jump statement in a finally block can discard an in-flight exception.

## V6052

An overridden method is called from a base-class constructor.

## V6053

A collection is modified while iteration is in progress.

## V6054

Classes are compared by name instead of identity.

## V6055

An assertion has a side effect. With assertions disabled, Java skips the expression. Check whether later code depends on the skipped change.

## V6056

A compareTo-like method overloads a base method instead of overriding it.

## V6057

An expression is excessive or contains a likely misprint.

## V6058

Objects of incompatible types are compared.

## V6059

A regular expression uses a special character suspiciously.

## V6060

A reference is used before a later null check.

## V6061

A constant is written in octal form.

## V6062

A method may recurse without reaching a base case.

## V6063

A stray semicolon follows an if, for, or while statement.

## V6064

Calling a thread’s `run()` directly executes it on the calling thread.

## V6065

A non-serializable class is used in serialization.

## V6066

A collection method receives objects of an incompatible type.

## V6067

Two or more case branches perform the same actions.

## V6068

A BigDecimal is used suspiciously, such as constructed from a double.

## V6069

A negative byte or short is unsigned-right-shifted with assignment.

## V6070

A synchronized block locks an unsafe object, such as a mutable or boxed one.

## V6071

A file carries a copyleft license that may oblige opening derived code.

## V6072

Two similar code fragments suggest the wrong variable in one of them.

## V6073

A toString or clone method returns null or throws an exception.

## V6074

A volatile variable is modified with a non-atomic compound operation.

## V6075

A method involved in serialization does not match the required signature.

## V6076

Repeated serialization may reuse the state cached by the first serialization.

## V6077

A label inside a switch may be a misspelled case or default. For example, `defaut:` is a legal label and will never select the default branch.

## V6078

An API is used in a way that may break on other Java SE versions.

## V6079

A value is checked after the same value was already used.

## V6080

A condition checks a different variable from the one just assigned, possibly reusing a stale result.

## V6081

An annotation without RUNTIME retention is read through reflection.

## V6082

A double-checked locking pattern may publish a partially constructed object.

## V6083

Fields are deserialized in an order that may not match their serialization order.

## V6084

A method suspiciously always returns an empty collection.

## V6085

A sequence of similar comparisons contains an abnormality, likely a typo.

## V6086

The formatting suggests a missing else keyword.

## V6087

Deserialization may fail with InvalidClassException due to a class version mismatch.

## V6088

A result is implicitly cast to a type that may lose information.

## V6089

A commented-out line may have altered the surrounding logic.

## V6090

A field is used before its initialization completes.

## V6091

A getter or setter touches a field other than the one in its name.

## V6092

A resource is returned from a try-with-resources block that closes it first.

## V6093

Automatic unboxing of a wrapper may throw a NullPointerException.

## V6094

An integer result is implicitly widened to a floating-point type.

## V6095

Thread.sleep runs inside a synchronized block or method.

## V6096

Two floating-point values are compared for exact equality.

## V6097

A long literal ends in a lowercase l that reads like a 1.

## V6098

A method looks like an override but does not override a base method.

## V6099

A nested loop starts at the outer index instead of the outer index plus one.

## V6100

An object is passed to its own method. Check the method contract for self-arguments. For a nonempty collection, the Collection.addAll contract leaves `c.addAll(c)` undefined.

## V6101

A comparison against a compareTo-like result assumes it is exactly -1, 0, or 1.

## V6102

A field is synchronized inconsistently across its uses.

## V6103

An InterruptedException is caught and ignored.

## V6104

A pattern of the form A || (A && ...) is excessive.

## V6105

A loop initializer and iterator appear to use different variables.

## V6106

An explicit cast preceding an implicit one may be excessive.

## V6107

An approximate constant is used where a more accurate one exists.

## V6108

A for loop counter is a floating-point variable.

## V6109

A pseudo-random generator is seeded with a predictable value.

## V6110

An environment variable may be unsafe or unreliable.

## V6111

A potentially negative value is used as an array size.

## V6112

Calling getClass repeatedly or on a class literal always produces the Class type.

## V6113

A division has a left operand smaller in magnitude than the right one.

## V6114

A class holding Closeable members does not release them.

## V6115

A close method releases only some of the Closeable members.

## V6116

A class defines a close method that releases resources but does not implement Closeable.

## V6117

Arithmetic may overflow before the result is widened. In `(long) (a * b)`, two int operands still multiply as ints.

## V6118

An original exception is swallowed, losing its cause.

## V6119

The result of a bitwise & is always zero.

## V6120

The result of a bitwise & is zero because one operand is zero.

## V6121

The return value of a method is ignored at some call sites.

## V6122

The date pattern uses week-based year (Y). Around New Year it can differ from calendar year (y).

## V6123

The value produced by an increment or decrement is never used afterwards.

## V6124

An integer literal is converted to a type too small to hold it.

## V6125

A thread calls wait, notify, or notifyAll without owning the receiver’s monitor. Check which object the current thread has synchronized on.

## V6126

Native synchronization is used on a high-level concurrency class.

## V6127

A Closeable object is not closed on some path.

## V6128

A Closeable object is used after it was closed.

## V6129

Locks may be acquired in different orders, risking a deadlock.

## V6130

An arithmetic expression may overflow int range.

## V6131

A cast to a narrower type may overflow or lose information.

## V6132

An else block may have been forgotten or commented out.

## V6133

An equals method dereferences its parameter without a null check.

## V6134

An equals method throws an exception for some inputs.

## V6135

A return in finally overrides the results of the try and catch blocks.

## V6136

Two bit flags share the same value.

## V5301

An empty catch block discards the exception. Check what the caller observes after the handler returns.

## V5302

An exception type has restricted visibility. Check whether callers outside its package can catch it by name.

## V5303

A newly constructed object is discarded. If it is an exception, check whether this path should throw it.

## V5304

Double-checked locking may expose a partially initialized object. Follow the read that skips the lock. A volatile reference can safely publish the object when the write happens after initialization.

## V5305

A credential appears in the source. Check whether the literal is used to authenticate.

## V5306

A handler loses the original exception. Check whether the replacement exception retains it as its cause.

## V5307

A random generator receives a predictable seed. Check what depends on the generated values being unpredictable.

## V5308

An arithmetic operation can overflow before its result is widened. Check the operand types at the operation.

## V5309

External input may change the structure of an SQL statement. Inspect the SQL text passed to the driver and each parameter binding. A prepared statement still contains any input concatenated into its text before preparation.

## V5310

External input may determine which operating system command runs. Trace the executable and any command string passed to a shell. When the program launches a fixed executable directly, inspect its argument handling separately.

## V5311

External input may change the options or arguments interpreted by a command, even when the executable is fixed. Identify the argument position the external value occupies and how the invoked program parses it. Passing separate arguments preserves their boundaries but may still let the value select an option.

## V5312

External input may change an XPath expression. Check whether the evaluator receives the input as a bound variable.

## V5313

The connection configuration permits an obsolete SSL or TLS protocol version. Inspect the enabled protocol versions on the socket or engine used by this connection. A generic TLS context name alone does not identify the versions it negotiates.

## V5314

The code selects an obsolete hash algorithm. Check which security property depends on the digest.

## V5315

The code selects an obsolete cryptographic algorithm. Identify the algorithm used by the configured provider.

## V5316

`getRequestedSessionId()` reads the session identifier supplied by the client. Check whether the server validates it before trusting it.

## V5317

The application implements its own cryptographic algorithm. Locate the implementation used at runtime. A wrapper that delegates the cryptographic operation to a standard provider differs from code implementing the primitive itself.

## V5318

The requested POSIX permissions grant access to users outside the file owner and group. Inspect which permissions they receive.

## V5319

External input is written to a log. Check whether the logging format preserves record boundaries.

## V5320

External input supplies a configuration value. Check which setting it controls and who may change it.

## V5321

External input may alter an LDAP search filter. Check how the filter value is encoded or bound.

## V5322

External input selects a class or method through reflection. Check which targets the application permits.

## V5323

External input determines the allowed CORS origin. Check whether the origin is validated before the response header is set.

## V5324

External input selects a redirect destination. Check which origins the application accepts.

## V5325

A wildcard CORS origin allows any origin to read an eligible response. Check whether the resource is intended to be public.

## V5326

The database connection uses an empty password. Trace the effective credentials to the database driver. An empty default can be replaced by configuration, and some deployments authenticate through a mechanism that requires no password.

## V5327

External input supplies part of a regular expression. Check whether it is intended as pattern syntax or literal text.

## V5328

The authorization rule may grant access more broadly than intended. Identify the resources and callers it covers.

## V5329

File creation spans separate operations. Check whether another process can claim the path between them.

## V5330

External input reaches a web response where the browser may interpret it as markup or script. Check the encoding for that output context.

## V5331

An IP address is embedded in the source. Check which endpoint the application will contact in each deployment.

## V5332

External input influences a filesystem path. Check whether the resolved target stays inside the permitted directory.

## V5333

A deserializer constructs objects from external data. Check which types it accepts.

## V5334

External input influences the destination of a server-side request. Trace the final request URI, including redirects if the client follows them. Check which destinations the application permits and where that restriction is enforced.

## V5335

The XML parser may resolve external entities while reading untrusted input. Inspect the factory that created this parser and the resolver it actually uses. Determine whether it permits external DTDs or entity references to read local or remote resources.

## V5336

Expanding entities in untrusted XML may exhaust resources. Inspect the limits on entity expansion for this parser. Internal entities can consume memory even when the resolver blocks external resources.

## V5337

External input may alter a NoSQL query. Check whether it can supply query operators or change the query structure.

## V5338

An archive entry name determines an extraction path. Check whether every resolved entry stays inside the destination directory.

## V5339

Untrusted code runs in a GraalVM context. Inspect the host access granted to that context.

## V5340

Invisible characters in source can hide differences between displayed and parsed code. Inspect the flagged characters.

## V5341

A cookie lacks the Secure attribute. Check whether the browser could send its value over an unencrypted connection.

## V5342

External input is stored in an object that later code may trust. Trace how the stored value is validated before use.

## V5343

A security-sensitive value comes from a noncryptographic random generator. Follow the generated value to its consumer. A password-reset token must resist guessing, while a random delay used for scheduling has no such requirement.
