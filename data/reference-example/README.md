# Reference example (simulated)

A small, fully worked example from the original proposal: eight sessions, six users, five
units and the invoices they should produce. Everything here is simulated.

It is the contract for the allocation engine. `apps/api/tests/modules/billing/domain/test_reference_golden.py`
checks that the engine reproduces the energy value and loss share of every invoice, and
documents the one deliberate difference: the product bills per unit, so a unit with two
vehicles pays the fixed fee once instead of twice.
