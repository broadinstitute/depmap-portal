import pytest

from depmap.database import transaction
from flask_sqlalchemy import SQLAlchemy

from flask import Flask


def test_transactional(tmpdir):
    app = Flask("test_db")
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///:memory:"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    #    app.config['SQLALCHEMY_ECHO'] = True

    db = SQLAlchemy()

    def successful(value):
        with transaction(db):
            db.session.add(Sample(value=value))
            db.session.flush()

    def fails(value):
        with transaction(db):
            db.session.add(Sample(value=value))
            db.session.flush()
            raise Exception("simulate error")

    def both():
        with transaction(db):
            successful("3")
            fails("4")

    class Sample(db.Model):
        value = db.Column(db.String, primary_key=True)

    db.init_app(app)

    with app.app_context():
        db.create_all()
        successful("1")

    with app.app_context():
        with pytest.raises(Exception):
            fails("2")

    with app.app_context():
        with pytest.raises(Exception):
            both()

    with app.app_context():
        with transaction(db):
            successful("5")
            successful("6")

    with app.app_context():
        assert ["1", "5", "6"] == [x.value for x in Sample.query.all()]
