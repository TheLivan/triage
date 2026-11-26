# PVS-Studio diagnostics

Rule summaries follow the [PVS-Studio documentation](https://pvs-studio.com/en/docs/warnings/). Each warning receives the text under its matching heading.

## V501

PVS-Studio diagnostic: Identical expressions on both sides of an operator suggest a copy-paste error.

Possible false-positive patterns (verify against the code): Check whether the operands only coincide in this macro or template instantiation, or whether two evaluations intentionally read different values.

## V522

PVS-Studio diagnostic: A reachable path may dereference a null pointer, including through a short-circuit condition.

Possible false-positive patterns (verify against the code): Check for a guard or a callee contract that rules out null on every path to the dereference. A wrapper that terminates on allocation failure can provide such a contract.

## V547

PVS-Studio diagnostic: An expression always evaluates to the same truth value according to the inferred value range.

Possible false-positive patterns (verify against the code): Check whether the condition varies across supported builds or is intentionally constant in this generated or generic code.

## V560

PVS-Studio diagnostic: One operand of a logical condition always evaluates to true or false in context.

Possible false-positive patterns (verify against the code): Check whether a macro or template intentionally includes the operand for configurations where it still affects the result.

## V595

PVS-Studio diagnostic: A pointer is dereferenced before a later null check suggests that it may be nullable.

Possible false-positive patterns (verify against the code): Check whether the earlier value is guaranteed non-null or whether the later check tests a value assigned after the dereference.

## V773

PVS-Studio diagnostic: A function may exit while still owning an unreleased pointer or handle.

Possible false-positive patterns (verify against the code): Check whether another owner took responsibility for the resource or whether a scope guard releases it on the reported path.

## V1006

PVS-Studio diagnostic: Independent shared_ptr owners of the same raw pointer may each delete it.

Possible false-positive patterns (verify against the code): Trace the control blocks and deleters. Copies share ownership, and a custom deleter may leave destruction to a single owner.

## V1012

PVS-Studio diagnostic: An overflow check can be unreachable because integer promotion widens the arithmetic before the comparison.

Possible false-positive patterns (verify against the code): Check the operand types on the target platform and any narrowing conversion before the comparison.

## V1020

PVS-Studio diagnostic: An early exit skips the closing call of an apparent setup and teardown pair.

Possible false-positive patterns (verify against the code): Check whether that path already undoes the setup through a helper or a scope guard, or whether the setup never took effect.

## V1028

PVS-Studio diagnostic: Arithmetic may overflow in the type of the operands before the result is widened.

Possible false-positive patterns (verify against the code): Check whether proven bounds keep every intermediate in range or whether the unsigned wraparound is deliberate.

## V1030

PVS-Studio diagnostic: A variable is used after being moved from.

Possible false-positive patterns (verify against the code): Check for reinitialization, an operation permitted on the moved-from state, or a call that binds an rvalue reference without moving.

## V1047

PVS-Studio diagnostic: A lambda can outlive a local variable it captures by reference.

Possible false-positive patterns (verify against the code): Check whether the callback is consumed synchronously or all asynchronous invocations finish before the captured variable dies.

## V1048

PVS-Studio diagnostic: An assignment writes the value the variable already holds on this path.

Possible false-positive patterns (verify against the code): Check whether a volatile write or an overloaded assignment has observable effects even when the value stays the same.

## V1049

PVS-Studio diagnostic: Two headers use the same include guard, so including one can suppress the contents of the other.

Possible false-positive patterns (verify against the code): Check the include paths and preprocessor conditions to see whether both headers can be needed in the same translation unit.

## V1050

PVS-Studio diagnostic: A base constructor receives a derived member before that member has been initialized.

Possible false-positive patterns (verify against the code): Trace when the value is read. A base constructor may store a reference and defer the first read until after initialization.

## V1061

PVS-Studio diagnostic: Adding declarations to the std or posix namespace can cause undefined behavior.

Possible false-positive patterns (verify against the code): Check whether the applicable standard permits this specific declaration, such as a std::hash specialization for a program-defined type.

## V1065

PVS-Studio diagnostic: An expression contains repeated operands that appear to cancel or can be eliminated.

Possible false-positive patterns (verify against the code): Check whether repeated evaluations have observable effects that invalidate the simplification. If the redundancy is real and only its intent is in question, use unsure.

## V3001

PVS-Studio diagnostic: Both operands of an operator contain the same expression, suggesting accidental duplication.

Possible false-positive patterns (verify against the code): Check whether repeated property getters or method calls intentionally return different values, or whether an overloaded operator makes the use intentional.

## V3080

PVS-Studio diagnostic: Data flow indicates a possible null reference at the point of dereference.

Possible false-positive patterns (verify against the code): Check for a guard with a non-null postcondition or a documented non-null return contract that applies on this path.

## V3095

PVS-Studio diagnostic: A reference is used before a later check against null.

Possible false-positive patterns (verify against the code): Check whether the early use requires a non-null value and whether reassignment or a caller invariant explains the later check.

## V3125

PVS-Studio diagnostic: A reference is used after a null check, but a path may still reach the use with null.

Possible false-positive patterns (verify against the code): Check whether the null branch always exits through a helper or the reference is assigned a non-null value before use.

## V6001

PVS-Studio diagnostic: Identical operands of an operator suggest a typo or copy-paste error.

Possible false-positive patterns (verify against the code): Check for an intentional floating-point NaN test or method calls whose results can differ between evaluations.

## V6002

PVS-Studio diagnostic: A switch statement does not cover all values of an enum.

Possible false-positive patterns (verify against the code): Check whether a default branch handles the remaining values or the uncovered cases are unreachable in this state machine.

## V6003

PVS-Studio diagnostic: The same condition guards both an if branch and a following else-if branch.

Possible false-positive patterns (verify against the code): Check whether the first branch mutates the tested value, making the repeated test intentional.

## V6004

PVS-Studio diagnostic: The then and else branches of a conditional perform equivalent actions.

Possible false-positive patterns (verify against the code): Check whether the branches differ only in logging or side effects the analyzer cannot model, or the duplication is kept for planned divergence.

## V6005

PVS-Studio diagnostic: A variable is assigned to itself.

Possible false-positive patterns (verify against the code): Check whether the self-assignment was meant for a different variable or field with a similar name.

## V6006

PVS-Studio diagnostic: An exception object is created but never thrown or used.

Possible false-positive patterns (verify against the code): Check whether the object is constructed for a side effect or the reference is used later, for example inside a lambda.

## V6007

PVS-Studio diagnostic: An expression always evaluates to the same truth value.

Possible false-positive patterns (verify against the code): Check whether the condition varies across build configurations or the constant result is intentional in generated or generic code.

## V6008

PVS-Studio diagnostic: A reference may be null when dereferenced.

Possible false-positive patterns (verify against the code): Check whether a library contract or a guard method excludes null on every path to the use.

## V6009

PVS-Studio diagnostic: A function receives an argument that looks wrong for its contract.

Possible false-positive patterns (verify against the code): Check the callee contract; sentinel values such as -1, 0, or null may be documented and handled on this path.

## V6010

PVS-Studio diagnostic: A method result is discarded even though the caller may need it.

Possible false-positive patterns (verify against the code): Check the method contract. A call may perform validation by throwing, even when its return value is unused.

## V6011

PVS-Studio diagnostic: An integer intermediate can lose precision before it is used in a floating-point expression.

Possible false-positive patterns (verify against the code): Check the operand types at the division and whether the input contract guarantees exact divisibility.

## V6012

PVS-Studio diagnostic: A ternary operator returns the same value regardless of its condition.

Possible false-positive patterns (verify against the code): Check whether the condition has an observable side effect or the value varies across configurations.

## V6013

PVS-Studio diagnostic: A comparison of strings, arrays, or collections tests reference identity where content equality may be required.

Possible false-positive patterns (verify against the code): Look for an identity sentinel or proof that both strings are interned. Equal contents alone do not imply identical references.

## V6014

PVS-Studio diagnostic: A method always returns the same constant.

Possible false-positive patterns (verify against the code): Check whether the constant is this implementation's documented behavior within a hierarchy where other implementations differ.

## V6015

PVS-Studio diagnostic: An expression probably meant to use !=, +=, or -= instead of the written operator.

Possible false-positive patterns (verify against the code): Check the surrounding idiom and operator precedence before assuming the operator is a typo.

## V6016

PVS-Studio diagnostic: A loop body accesses the same constant index on every iteration.

Possible false-positive patterns (verify against the code): Check whether every element is deliberately compared or combined with the element at that fixed index.

## V6017

PVS-Studio diagnostic: The counter of an outer loop is not used inside the nested loop.

Possible false-positive patterns (verify against the code): Check whether the inner loop intentionally reuses a different counter, such as when flattening indices.

## V6018

PVS-Studio diagnostic: A switch statement tests a constant expression.

Possible false-positive patterns (verify against the code): Check whether the expression is a deliberate compile-time constant or generated code kept for uniformity.

## V6019

PVS-Studio diagnostic: Unreachable code follows a statement that always exits or throws.

Possible false-positive patterns (verify against the code): Check whether the code is reached through another entry point, such as an exception path or reflection.

## V6020

PVS-Studio diagnostic: A divisor may be zero in a division or remainder expression.

Possible false-positive patterns (verify against the code): Trace the actual divisor and check for a guard or a caller contract that excludes zero on every path to the operation.

## V6021

PVS-Studio diagnostic: An assigned value is never read afterwards.

Possible false-positive patterns (verify against the code): Check whether the assignment keeps a side effect or the field is part of a framework contract.

## V6022

PVS-Studio diagnostic: A method parameter is never used in the body.

Possible false-positive patterns (verify against the code): Check whether the signature is fixed by an interface or framework hook, making the unused parameter required.

## V6023

PVS-Studio diagnostic: A parameter is always overwritten before its first use.

Possible false-positive patterns (verify against the code): Check whether the overwrite is a defensive copy or a documented normalization of caller input.

## V6024

PVS-Studio diagnostic: A continue statement terminates a do-while(false) loop unconditionally.

Possible false-positive patterns (verify against the code): Check whether the single-pass do-while is a deliberate structured-goto construct.

## V6025

PVS-Studio diagnostic: An index may lie outside the collection bounds.

Possible false-positive patterns (verify against the code): Trace the actual bounds and check for a guard or caller contract that keeps the index in range on every path.

## V6026

PVS-Studio diagnostic: A value is assigned that the variable already holds.

Possible false-positive patterns (verify against the code): Check whether the repeated assignment is a reset on a loop or exceptional path where the value may differ.

## V6027

PVS-Studio diagnostic: Two variables are initialized with the result of the same call.

Possible false-positive patterns (verify against the code): Check whether the shared call has side effects or seeding both values identically is intentional.

## V6028

PVS-Studio diagnostic: A compound assignment applies the same expression to both sides.

Possible false-positive patterns (verify against the code): Check whether the repetition is a deliberate idiom, such as x += x doubling or exponent-style growth.

## V6029

PVS-Studio diagnostic: Arguments passed to a method may be swapped.

Possible false-positive patterns (verify against the code): Check the callee parameter names and semantics; compatible types alone do not prove a swap.

## V6030

PVS-Studio diagnostic: The right operand of a bitwise & or | on booleans is evaluated unconditionally.

Possible false-positive patterns (verify against the code): Check whether the unconditional evaluation is required for side effects; otherwise the operator is likely a typo for && or ||.

## V6031

PVS-Studio diagnostic: The same variable serves as the counter of both an outer loop and a nested loop.

Possible false-positive patterns (verify against the code): Check whether reusing the outer counter is intentional, such as continuing a cumulative computation.

## V6032

PVS-Studio diagnostic: Two method bodies are fully equivalent.

Possible false-positive patterns (verify against the code): Check whether the methods are interface implementations that legitimately coincide; if the duplication is real but intended, use unsure.

## V6033

PVS-Studio diagnostic: A collection may receive a key it already contains.

Possible false-positive patterns (verify against the code): Check whether an earlier guard excludes duplicate keys or the later insertion is a deliberate replacement.

## V6034

PVS-Studio diagnostic: A shift count is inconsistent with the width of the shifted type.

Possible false-positive patterns (verify against the code): Check whether the shift wraps modulo the type width by design or the value is widened before the shift.

## V6035

PVS-Studio diagnostic: An expression contains a double negation.

Possible false-positive patterns (verify against the code): Check whether the repeated negation normalizes a non-boolean value or comes from generated code.

## V6036

PVS-Studio diagnostic: A value is read from an Optional that may not be present.

Possible false-positive patterns (verify against the code): Check for an isPresent guard or a callee contract that guarantees the optional holds a value on this path.

## V6037

PVS-Studio diagnostic: A loop body contains an unconditional break, continue, or return.

Possible false-positive patterns (verify against the code): Check whether the statement is actually guarded by a condition the analyzer simplified away.

## V6038

PVS-Studio diagnostic: A value is compared against Double.NaN with == or !=.

Possible false-positive patterns (verify against the code): Check whether the value can never be NaN on this path, which makes the comparison dead rather than wrong.

## V6039

PVS-Studio diagnostic: A second if repeats the condition of an earlier if that always returns.

Possible false-positive patterns (verify against the code): Check whether the first branch can fall through on some path, making the second check reachable.

## V6040

PVS-Studio diagnostic: The code's runtime logic does not match its indentation.

Possible false-positive patterns (verify against the code): Check the brace placement; if the runtime behavior is already intended, only the formatting misleads.

## V6041

PVS-Studio diagnostic: An assignment hides inside the condition of an if or while statement.

Possible false-positive patterns (verify against the code): Check whether the idiom is intentional, such as a read loop that assigns and tests in one condition.

## V6042

PVS-Studio diagnostic: A value is checked for compatibility with one type but cast to another.

Possible false-positive patterns (verify against the code): Check whether both types share a hierarchy making the cast valid while the check is only an optimization.

## V6043

PVS-Studio diagnostic: The initial and final values of a loop iterator are the same.

Possible false-positive patterns (verify against the code): Check whether the loop is generated or templated and the bounds vary in other instantiations.

## V6044

PVS-Studio diagnostic: A postfix increment or decrement is discarded because the variable is overwritten.

Possible false-positive patterns (verify against the code): Check whether the postfix value was read before the overwrite through an alias or an earlier statement.

## V6045

PVS-Studio diagnostic: A sequence of similar comparisons contains a repeated or suspicious subexpression.

Possible false-positive patterns (verify against the code): Check operator precedence and whether the chain intentionally repeats the middle operand.

## V6046

PVS-Studio diagnostic: Format specifiers and supplied arguments may disagree in count or type.

Possible false-positive patterns (verify against the code): Resolve explicit argument indexes and argument reuse in the format string, then check the runtime types of the selected arguments.

## V6047

PVS-Studio diagnostic: An else branch may belong to the previous if statement.

Possible false-positive patterns (verify against the code): Check the brace placement; if the else binds as written and the result is intended, only readability suffers.

## V6048

PVS-Studio diagnostic: An expression can be simplified because one operand equals a constant.

Possible false-positive patterns (verify against the code): Check whether the constant is a deliberate mask or bit trick; if the simplification is valid but the intent is unclear, use unsure.

## V6049

PVS-Studio diagnostic: A class defines equals without hashCode.

Possible false-positive patterns (verify against the code): Check whether the class is never used as a hash key or inherits a compatible hashCode from a superclass.

## V6050

PVS-Studio diagnostic: Class initializers may form a cycle.

Possible false-positive patterns (verify against the code): Check whether the cycle actually executes at class initialization time or only involves compile-time constants.

## V6051

PVS-Studio diagnostic: A jump statement in a finally block can discard an in-flight exception.

Possible false-positive patterns (verify against the code): Check whether the finally block can only run when no exception is in flight on this path.

## V6052

PVS-Studio diagnostic: An overridden method is called from a base-class constructor.

Possible false-positive patterns (verify against the code): Check whether the override is final, empty, or safe to call before the derived fields are initialized.

## V6053

PVS-Studio diagnostic: A collection is modified while iteration is in progress.

Possible false-positive patterns (verify against the code): Check whether the modification happens outside the iteration or the collection is a concurrent-safe type.

## V6054

PVS-Studio diagnostic: Classes are compared by name instead of identity.

Possible false-positive patterns (verify against the code): Check whether name comparison is a documented workaround, such as comparing classes across classloaders.

## V6055

PVS-Studio diagnostic: An expression inside an assert statement can change object state.

Possible false-positive patterns (verify against the code): Check whether assertions are disabled in production, making the side effect vanish where it matters.

## V6056

PVS-Studio diagnostic: A compareTo-like method overloads a base method instead of overriding it.

Possible false-positive patterns (verify against the code): Check whether the differing parameter type is intentional, such as comparing against a distinct type.

## V6057

PVS-Studio diagnostic: An expression is excessive or contains a likely misprint.

Possible false-positive patterns (verify against the code): Check whether the redundancy comes from generated or defensive code before calling it an error.

## V6058

PVS-Studio diagnostic: Objects of incompatible types are compared.

Possible false-positive patterns (verify against the code): Check for a shared subtype or generic erasure that makes the comparison valid at runtime.

## V6059

PVS-Studio diagnostic: A regular expression uses a special character suspiciously.

Possible false-positive patterns (verify against the code): Check whether the character is an intentional metacharacter or the pattern is assembled from trusted fragments.

## V6060

PVS-Studio diagnostic: A reference is used before a later null check.

Possible false-positive patterns (verify against the code): Check whether a caller contract guarantees the earlier value or the later check applies to a newly assigned value.

## V6061

PVS-Studio diagnostic: A constant is written in octal form.

Possible false-positive patterns (verify against the code): Check whether the leading zero is a deliberate legacy idiom, such as file permission bits.

## V6062

PVS-Studio diagnostic: A method may recurse without reaching a base case.

Possible false-positive patterns (verify against the code): Check for a state change, overload dispatch, or guard that terminates the recursion on another path.

## V6063

PVS-Studio diagnostic: A stray semicolon follows an if, for, or while statement.

Possible false-positive patterns (verify against the code): Check whether the empty statement is intentional and the real body follows in braces.

## V6064

PVS-Studio diagnostic: A thread is started by calling run() instead of start().

Possible false-positive patterns (verify against the code): Check whether the synchronous call is intentional; run() executes in the caller's thread without parallelism.

## V6065

PVS-Studio diagnostic: A non-serializable class is used in serialization.

Possible false-positive patterns (verify against the code): Check whether the field is transient or a custom writeObject handles the object explicitly.

## V6066

PVS-Studio diagnostic: A collection method receives objects of an incompatible type.

Possible false-positive patterns (verify against the code): Check whether generic erasure hides a common supertype that makes the element compatible at runtime.

## V6067

PVS-Studio diagnostic: Two or more case branches perform the same actions.

Possible false-positive patterns (verify against the code): Check whether the branches fall through by design or are kept separate for planned divergence.

## V6068

PVS-Studio diagnostic: A BigDecimal is used suspiciously, such as constructed from a double.

Possible false-positive patterns (verify against the code): Check the constructor and the required scale; BigDecimal.valueOf may already produce the intended value.

## V6069

PVS-Studio diagnostic: A negative byte or short is unsigned-right-shifted with assignment.

Possible false-positive patterns (verify against the code): Check whether the sign-extension to int before the shift matches the intended masking.

## V6070

PVS-Studio diagnostic: A synchronized block locks an unsafe object, such as a mutable or boxed one.

Possible false-positive patterns (verify against the code): Check whether the monitor is effectively confined and stable for every thread that contends on it.

## V6071

PVS-Studio diagnostic: A file carries a copyleft license that may oblige opening derived code.

Possible false-positive patterns (verify against the code): Check the file's actual license and whether the project's distribution model already complies with it.

## V6072

PVS-Studio diagnostic: Two similar code fragments suggest the wrong variable in one of them.

Possible false-positive patterns (verify against the code): Check whether the repetition is deliberate symmetry; if so, only a naming issue remains, so use unsure.

## V6073

PVS-Studio diagnostic: A toString or clone method returns null or throws an exception.

Possible false-positive patterns (verify against the code): Check whether callers already guard against null or the throw marks an unsupported operation.

## V6074

PVS-Studio diagnostic: A volatile variable is modified with a non-atomic compound operation.

Possible false-positive patterns (verify against the code): Check whether an external lock or single-thread confinement makes the compound update safe.

## V6075

PVS-Studio diagnostic: A method involved in serialization does not match the required signature.

Possible false-positive patterns (verify against the code): Check whether the method is actually invoked by the serialization machinery or is a plain helper.

## V6076

PVS-Studio diagnostic: Repeated serialization may reuse the state cached by the first serialization.

Possible false-positive patterns (verify against the code): Check whether each object is serialized once in its lifetime or the cached state is acceptable.

## V6077

PVS-Studio diagnostic: A suspicious label inside a switch may be a misspelled case or default.

Possible false-positive patterns (verify against the code): Check whether the label is an intentional goto target or the branch name is a typo.

## V6078

PVS-Studio diagnostic: An API is used in a way that may break on other Java SE versions.

Possible false-positive patterns (verify against the code): Check the project's minimum target runtime; usage valid on the supported baseline is not a defect.

## V6079

PVS-Studio diagnostic: A value is checked after the same value was already used.

Possible false-positive patterns (verify against the code): Check whether the earlier use requires a non-null or valid value or the value is reassigned in between.

## V6080

PVS-Studio diagnostic: A condition checks a different variable from the one just assigned, possibly reusing a stale result.

Possible false-positive patterns (verify against the code): Trace which operation the branch handles and whether the newly assigned value is checked separately.

## V6081

PVS-Studio diagnostic: An annotation without RUNTIME retention is read through reflection.

Possible false-positive patterns (verify against the code): Check whether the annotation is deliberately compile-time only and the reflective path never runs.

## V6082

PVS-Studio diagnostic: A double-checked locking pattern may publish a partially constructed object.

Possible false-positive patterns (verify against the code): Check whether the guarded field is volatile; with a volatile field the pattern is safe in modern Java.

## V6083

PVS-Studio diagnostic: Fields are deserialized in an order that may not match their serialization order.

Possible false-positive patterns (verify against the code): Check whether custom readObject and writeObject implementations keep the two orders consistent.

## V6084

PVS-Studio diagnostic: A method suspiciously always returns an empty collection.

Possible false-positive patterns (verify against the code): Check whether callers expect a shared immutable empty instance or a fresh mutable one.

## V6085

PVS-Studio diagnostic: A sequence of similar comparisons contains an abnormality, likely a typo.

Possible false-positive patterns (verify against the code): Check the direction of each comparison and the operand order before confirming the typo.

## V6086

PVS-Studio diagnostic: The formatting suggests a missing else keyword.

Possible false-positive patterns (verify against the code): Check the brace placement; if the behavior is intended, only the layout misleads the reader.

## V6087

PVS-Studio diagnostic: Deserialization may fail with InvalidClassException due to a class version mismatch.

Possible false-positive patterns (verify against the code): Check whether serialVersionUID is pinned and both sides deploy the same class version.

## V6088

PVS-Studio diagnostic: A result is implicitly cast to a type that may lose information.

Possible false-positive patterns (verify against the code): Check whether the input contract bounds the value so the narrowing conversion stays exact.

## V6089

PVS-Studio diagnostic: A commented-out line may have altered the surrounding logic.

Possible false-positive patterns (verify against the code): Check the comment markers; the code may have been disabled deliberately with the remaining logic intact.

## V6090

PVS-Studio diagnostic: A field is used before its initialization completes.

Possible false-positive patterns (verify against the code): Check the initialization order; a use inside a method runs after construction unless invoked early from a constructor or an override.

## V6091

PVS-Studio diagnostic: A getter or setter touches a field other than the one in its name.

Possible false-positive patterns (verify against the code): Check whether the wrong field is a typo or a deliberate alias; with a single field the behavior may already be correct.

## V6092

PVS-Studio diagnostic: A resource is returned from a try-with-resources block that closes it first.

Possible false-positive patterns (verify against the code): Check whether the caller needs the resource open; if the return value is never used afterwards, only intent is in question.

## V6093

PVS-Studio diagnostic: Automatic unboxing of a wrapper may throw a NullPointerException.

Possible false-positive patterns (verify against the code): Check for a guard or contract that guarantees a non-null value, or whether the source is a boxed constant.

## V6094

PVS-Studio diagnostic: An integer result is implicitly widened to a floating-point type.

Possible false-positive patterns (verify against the code): Check whether the fractional loss from integer division is intended by the algorithm.

## V6095

PVS-Studio diagnostic: Thread.sleep runs inside a synchronized block or method.

Possible false-positive patterns (verify against the code): Check whether the sleep is a deliberate throttle; a missed wait or await would release the lock.

## V6096

PVS-Studio diagnostic: Two floating-point values are compared for exact equality.

Possible false-positive patterns (verify against the code): Check whether the values are exactly representable or a tolerance is applied before the comparison.

## V6097

PVS-Studio diagnostic: A long literal ends in a lowercase l that reads like a 1.

Possible false-positive patterns (verify against the code): Check the literal digits; if the value is correct, the warning is cosmetic only.

## V6098

PVS-Studio diagnostic: A method looks like an override but does not override a base method.

Possible false-positive patterns (verify against the code): Check for a differing parameter type; the method may be an intentional overload rather than a misspelled override.

## V6099

PVS-Studio diagnostic: A nested loop starts at the outer index instead of the outer index plus one.

Possible false-positive patterns (verify against the code): Check whether the diagonal repetition is intended, such as symmetric pairwise processing.

## V6100

PVS-Studio diagnostic: An object is passed as an argument to its own method.

Possible false-positive patterns (verify against the code): Check the method contract; some methods, such as addAll on a collection, accept the receiver deliberately.

## V6101

PVS-Studio diagnostic: A comparison against a compareTo-like result assumes it is exactly -1, 0, or 1.

Possible false-positive patterns (verify against the code): Check the specific implementation; a method documented to return exactly -1, 0, or 1 makes the comparison safe.

## V6102

PVS-Studio diagnostic: A field is synchronized inconsistently across its uses.

Possible false-positive patterns (verify against the code): Check whether accesses are confined to a single thread or covered by a documented external lock.

## V6103

PVS-Studio diagnostic: An InterruptedException is caught and ignored.

Possible false-positive patterns (verify against the code): Check whether the interruption is handled elsewhere or the flag is restored by a caller.

## V6104

PVS-Studio diagnostic: A pattern of the form A || (A && ...) is excessive.

Possible false-positive patterns (verify against the code): Check whether the repeated subexpression has side effects the simplification would remove.

## V6105

PVS-Studio diagnostic: A loop initializer and iterator appear to use different variables.

Possible false-positive patterns (verify against the code): Check whether the mismatch is a deliberate traversal, such as stepping two cursors at once.

## V6106

PVS-Studio diagnostic: An explicit cast preceding an implicit one may be excessive.

Possible false-positive patterns (verify against the code): Check whether the intermediate cast changes the result, such as truncation before widening.

## V6107

PVS-Studio diagnostic: An approximate constant is used where a more accurate one exists.

Possible false-positive patterns (verify against the code): Check the precision the calculation requires; the approximate constant may be deliberate.

## V6108

PVS-Studio diagnostic: A for loop counter is a floating-point variable.

Possible false-positive patterns (verify against the code): Check whether the step and bounds make the iteration count exact despite rounding.

## V6109

PVS-Studio diagnostic: A pseudo-random generator is seeded with a predictable value.

Possible false-positive patterns (verify against the code): Check whether reproducibility is intended, such as in tests; only security-sensitive randomness is at risk.

## V6110

PVS-Studio diagnostic: An environment variable may be unsafe or unreliable.

Possible false-positive patterns (verify against the code): Check whether the deployment contract documents the variable and its trusted source.

## V6111

PVS-Studio diagnostic: A potentially negative value is used as an array size.

Possible false-positive patterns (verify against the code): Check for a guard, clamp, or caller contract that guarantees a non-negative value.

## V6112

PVS-Studio diagnostic: Calling getClass repeatedly or on a class literal always produces the Class type.

Possible false-positive patterns (verify against the code): Check whether the exact-type comparison against the Class instance is intended instead of instanceof semantics.

## V6113

PVS-Studio diagnostic: A division has a left operand smaller in magnitude than the right one.

Possible false-positive patterns (verify against the code): Check whether the zero fraction is intended, such as computing a ratio or a floor step.

## V6114

PVS-Studio diagnostic: A class holding Closeable members does not release them.

Possible false-positive patterns (verify against the code): Check whether the members are owned and closed elsewhere or the class is a passive holder.

## V6115

PVS-Studio diagnostic: A close method releases only some of the Closeable members.

Possible false-positive patterns (verify against the code): Check whether the remaining members are closed by another layer or are intentionally left open.

## V6116

PVS-Studio diagnostic: A class defines a close method that releases resources but does not implement Closeable.

Possible false-positive patterns (verify against the code): Check whether an external contract requires the method; if the release is correct, only the interface is missing, so use unsure.

## V6117

PVS-Studio diagnostic: An arithmetic result may overflow before it is cast to a wider type.

Possible false-positive patterns (verify against the code): Check the proven bounds of the operands; the intermediate may stay in range for all real inputs.

## V6118

PVS-Studio diagnostic: An original exception is swallowed, losing its cause.

Possible false-positive patterns (verify against the code): Check whether the cause is chained into the new exception or the information is hidden deliberately.

## V6119

PVS-Studio diagnostic: The result of a bitwise & is always zero.

Possible false-positive patterns (verify against the code): Check the bit widths; disjoint masks make the expression dead rather than wrong.

## V6120

PVS-Studio diagnostic: The result of a bitwise & is zero because one operand is zero.

Possible false-positive patterns (verify against the code): Check whether the zero operand is configuration-dependent or a deliberate clearing mask.

## V6121

PVS-Studio diagnostic: The return value of a method is ignored at some call sites.

Possible false-positive patterns (verify against the code): Check each call site; an ignored result may be deliberate where the method also performs an action.

## V6122

PVS-Studio diagnostic: A date format uses the Y week-year pattern.

Possible false-positive patterns (verify against the code): Check whether week-year is intended, such as with ISO week calendars.

## V6123

PVS-Studio diagnostic: The value produced by an increment or decrement is never used afterwards.

Possible false-positive patterns (verify against the code): Check whether a later read happens through an alias or the operation is kept for symmetry.

## V6124

PVS-Studio diagnostic: An integer literal is converted to a type too small to hold it.

Possible false-positive patterns (verify against the code): Check whether the literal fits the target range after conversion; the narrowing may be exact by design.

## V6125

PVS-Studio diagnostic: wait, notify, or notifyAll is called outside a synchronized context.

Possible false-positive patterns (verify against the code): Check for an enclosing synchronized block or a lock held through a caller.

## V6126

PVS-Studio diagnostic: Native synchronization is used on a high-level concurrency class.

Possible false-positive patterns (verify against the code): Check whether an external protocol requires the monitor despite the class's own guarantees.

## V6127

PVS-Studio diagnostic: A Closeable object is not closed on some path.

Possible false-positive patterns (verify against the code): Check for an owner that closes it, a caller's try-with-resources, or a cache managing its lifecycle.

## V6128

PVS-Studio diagnostic: A Closeable object is used after it was closed.

Possible false-positive patterns (verify against the code): Check whether every use happens before the close in all control flows.

## V6129

PVS-Studio diagnostic: Locks may be acquired in different orders, risking a deadlock.

Possible false-positive patterns (verify against the code): Check whether the locks can never be held simultaneously or the order is enforced by a helper.

## V6130

PVS-Studio diagnostic: An arithmetic expression may overflow int range.

Possible false-positive patterns (verify against the code): Check the proven bounds of the operands; the result may stay in range for all real inputs.

## V6131

PVS-Studio diagnostic: A cast to a narrower type may overflow or lose information.

Possible false-positive patterns (verify against the code): Check the runtime value range; the narrowing may be safe under the caller contract.

## V6132

PVS-Studio diagnostic: An else block may have been forgotten or commented out.

Possible false-positive patterns (verify against the code): Check the comment markers and braces; the else may have been removed deliberately.

## V6133

PVS-Studio diagnostic: An equals method dereferences its parameter without a null check.

Possible false-positive patterns (verify against the code): Check whether callers can pass null; equals(null) should return false rather than throw.

## V6134

PVS-Studio diagnostic: An equals method throws an exception for some inputs.

Possible false-positive patterns (verify against the code): Check whether an instanceof guard makes the throw unreachable on every path.

## V6135

PVS-Studio diagnostic: A return in finally overrides the results of the try and catch blocks.

Possible false-positive patterns (verify against the code): Check whether the override deliberately suppresses an in-flight result or exception.

## V6136

PVS-Studio diagnostic: Two bit flags share the same value.

Possible false-positive patterns (verify against the code): Check whether the duplicate value is an intentional alias or the overlap breaks the mask logic.

## V7001

PVS-Studio diagnostic: Equivalent operands of a binary operator can indicate accidental duplication.

Possible false-positive patterns (verify against the code): Check for an intentional NaN self-comparison or repeated getter or function calls with different results.

## V8001

PVS-Studio diagnostic: A binary operator has identical subexpressions on both sides.

Possible false-positive patterns (verify against the code): Check for an intentional NaN self-comparison or repeated calls whose results can differ between evaluations.
