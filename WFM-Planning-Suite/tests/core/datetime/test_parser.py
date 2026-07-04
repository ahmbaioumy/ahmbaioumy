from datetime import datetime

import pytest

from core.datetime.parser import DateOrder, parse_datetime, parse_series, resolve_date_format


@pytest.mark.tier1
class TestDateParsing:
    def test_unambiguous_dmy(self):
        values = ["25/01/2024 09:00", "26/01/2024 09:30", "15/02/2024 10:00"]
        order, fmt = resolve_date_format(values)
        assert order == DateOrder.DMY

    def test_unambiguous_mdy(self):
        values = ["01/25/2024 09:00", "02/15/2024 09:30"]
        order, fmt = resolve_date_format(values)
        assert order == DateOrder.MDY

    def test_ymd_detected(self):
        values = ["2024-01-25 09:00", "2024-01-26 09:30"]
        order, fmt = resolve_date_format(values)
        assert order == DateOrder.YMD

    def test_parse_series_consistency(self):
        values = ["25/01/2024 09:00", "26/01/2024 09:30"]
        parsed, order, _ = parse_series(values)
        assert len(parsed) == 2
        assert parsed[0] == datetime(2024, 1, 25, 9, 0)
        assert order == DateOrder.DMY

    def test_same_format_all_stages(self):
        values = ["25/01/2024 09:00", "26/01/2024 09:30"]
        order, _ = resolve_date_format(values)
        for v in values:
            assert parse_datetime(v, order).year == 2024
