# -*- coding: utf-8 -*-
"""Factories to help in tests."""
from factory.alchemy import SQLAlchemyModelFactory

from depmap.database import db


class BaseFactory(SQLAlchemyModelFactory):
    """Base factory."""

    class Meta:
        """Factory configuration."""

        abstract = True
        sqlalchemy_session = db.session

        # Left commented as an example for future factories. Remove once we have an example.
        # class UserFactory(BaseFactory):
        #     """User factory."""
        #
        #     username = Sequence(lambda n: 'user{0}'.format(n))
        #     email = Sequence(lambda n: 'user{0}@example.com'.format(n))
        #     password = PostGenerationMethodCall('set_password', 'example')
        #     active = True
        #
        #     class Meta:
        #         """Factory configuration."""
        #
        #         model = User
