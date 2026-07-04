from pathlib import Path

import pytest

from wfm_io.files import load_upload


@pytest.mark.tier2
def test_load_sample_csv():
    path = Path(__file__).parent.parent / "fixtures" / "sample_interval_data.csv"
    upload = load_upload(path)
    assert len(upload.rows) > 0
    assert upload.date_range is not None
    errors = [i for i in upload.issues if i.severity == "error"]
    assert len(errors) == 0
