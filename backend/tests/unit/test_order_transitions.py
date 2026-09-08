"""Unit: the order lifecycle state machine."""

from features.orders.orders_usecases import ALLOWED_TRANSITIONS
from features.orders.schemas import OrderStatus


class TestLifecycle:
    def test_pending_can_be_paid_or_cancelled(self):
        assert ALLOWED_TRANSITIONS[OrderStatus.PENDING] == {
            OrderStatus.PAID,
            OrderStatus.CANCELLED,
        }

    def test_paid_can_be_shipped_or_cancelled(self):
        assert ALLOWED_TRANSITIONS[OrderStatus.PAID] == {
            OrderStatus.SHIPPED,
            OrderStatus.CANCELLED,
        }

    def test_shipped_can_only_be_delivered(self):
        assert ALLOWED_TRANSITIONS[OrderStatus.SHIPPED] == {OrderStatus.DELIVERED}

    def test_terminal_states_allow_nothing(self):
        assert ALLOWED_TRANSITIONS[OrderStatus.DELIVERED] == set()
        assert ALLOWED_TRANSITIONS[OrderStatus.CANCELLED] == set()

    def test_every_status_has_a_rule(self):
        # A new status without an explicit rule would silently forbid
        # everything; make that a conscious decision instead.
        assert set(ALLOWED_TRANSITIONS) == set(OrderStatus)

    def test_no_transition_escapes_a_cancellation(self):
        # Cancelled orders restored their stock; reviving them would corrupt it.
        for targets in ALLOWED_TRANSITIONS.values():
            assert OrderStatus.PENDING not in targets
