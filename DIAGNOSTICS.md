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

## V6008

PVS-Studio diagnostic: A reference may be null when dereferenced.

Possible false-positive patterns (verify against the code): Check whether a library contract or a guard method excludes null on every path to the use.

## V6010

PVS-Studio diagnostic: A method result is discarded even though the caller may need it.

Possible false-positive patterns (verify against the code): Check the method contract. A call may perform validation by throwing, even when its return value is unused.

## V6011

PVS-Studio diagnostic: An integer intermediate can lose precision before it is used in a floating-point expression.

Possible false-positive patterns (verify against the code): Check the operand types at the division and whether the input contract guarantees exact divisibility.

## V6013

PVS-Studio diagnostic: A comparison of strings, arrays, or collections tests reference identity where content equality may be required.

Possible false-positive patterns (verify against the code): Look for an identity sentinel or proof that both strings are interned. Equal contents alone do not imply identical references.

## V6020

PVS-Studio diagnostic: A divisor may be zero in a division or remainder expression.

Possible false-positive patterns (verify against the code): Trace the actual divisor and check for a guard or a caller contract that excludes zero on every path to the operation.

## V6046

PVS-Studio diagnostic: Format specifiers and supplied arguments may disagree in count or type.

Possible false-positive patterns (verify against the code): Resolve explicit argument indexes and argument reuse in the format string, then check the runtime types of the selected arguments.

## V6060

PVS-Studio diagnostic: A reference is used before a later null check.

Possible false-positive patterns (verify against the code): Check whether a caller contract guarantees the earlier value or the later check applies to a newly assigned value.

## V6080

PVS-Studio diagnostic: A condition checks a different variable from the one just assigned, possibly reusing a stale result.

Possible false-positive patterns (verify against the code): Trace which operation the branch handles and whether the newly assigned value is checked separately.

## V7001

PVS-Studio diagnostic: Equivalent operands of a binary operator can indicate accidental duplication.

Possible false-positive patterns (verify against the code): Check for an intentional NaN self-comparison or repeated getter or function calls with different results.

## V8001

PVS-Studio diagnostic: A binary operator has identical subexpressions on both sides.

Possible false-positive patterns (verify against the code): Check for an intentional NaN self-comparison or repeated calls whose results can differ between evaluations.
