import pytest

from core.cleansing.strategies import (
    IMPUTATION_METHODS,
    apply_cleansing,
    impute_linear_interpolation,
    impute_median,
    impute_rolling_mean,
)


@pytest.mark.tier1
class TestImputationDistinctness:
    def test_three_methods_exist(self):
        assert len(IMPUTATION_METHODS) == 3

    def test_median_vs_linear_differ(self):
        values = [10.0, 20.0, 100.0, 50.0, 40.0]
        anomalies = [2]
        median_result, _ = impute_median(values, anomalies)
        linear_result, _ = impute_linear_interpolation(values, anomalies)
        assert median_result[2] != linear_result[2]

    def test_rolling_differs_from_median(self):
        values = [100.0, 20.0, 500.0, 30.0, 40.0]
        anomalies = [2]
        median_result, _ = impute_median(values, anomalies)
        rolling_result, _ = impute_rolling_mean(values, anomalies)
        assert median_result[2] != rolling_result[2]

    def test_apply_cleansing_returns_changes(self):
        values = [10.0, 10.0, 10.0, 10.0, 500.0, 10.0, 10.0, 10.0, 10.0, 10.0]
        cleaned, changes, anomalies = apply_cleansing(values, "median", z_threshold=2.0)
        assert len(anomalies) >= 1
        assert len(changes) >= 1
        assert cleaned[4] < 500.0
