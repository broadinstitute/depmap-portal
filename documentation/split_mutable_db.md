# Writeup on splitting mutable tables into a separate database

## Motivation

We have the guarantee that data does not need to persist from across deploys. Specifically, this allows us to have a one-way flow of data, where we recreate the database every time we need to make a change to the underlying data. The database and any data that currently resides on a server can always be trashed.

We also mostly assume that the depmap portal database is an immutable, read-only database. This has some exceptions, specifically that some database tables and accompanying files are writable caches, i.e. "transient mutable". They are transient in the sense that they can indeed be tossed with every deploy. However, these tables and folders are mutable in the sense that they are written toafter deploy, usually with user-supplied data. Currently, functionality with "transient mutable" data includes plotting custom datasets and running custom associations in data explorer.

The database (and files) is thus currently a mix of data that we consider immutable, and other tables that we write to. There are some general, theoretical benefits we may want from partitioning the immutable and mutable data. For instance, this would allow multiple workers to serve read-only requests from the immutable database without needing a lock; a lock must only be in place for using the mutable data. In our deploy process from staging to production, we check the timestamp on the database as a means to skip copying data unnecessarily. If we were to run a custom analysis on staging, this would bump the timestamp and trigger an unnecessary (if harmless) copy.

These are all theoretical benefits that we have not found pressing need to make use of. However, we wanted to verify that our current system is amenable to refactor, and assess the cost of this refactor, should we find ourselves in a future where we wanted to reap these benefits. This document is thus an outcome of an experiment in this refactor, and describes what one might do to shift our data to a system whereby immutable and mutable data are segregated.

## Attaching two databases at a sqlite level

Two sqlite databases can be joined together at a sqlite level using the `ATTACH` statement. After attaching, tables in both databases can be referenced. The syntax `<db name>.<table name>` specifies which table to use.
This `ATTACH` statement allows us to thus have two sqlite db files, one for immutable data, and one for "transient mutable" data.

## Getting SQLAlchemy to connect to attached databases

We can inject code that attaches the second database before initializing the sqlalchemy db connection that we use throughout the app. This requires upgrading to at least `Flask-SQLAlchemy==2.4`.

Add flask config variables in settings.py specifying the location of the second database. The word `mutable` was selected instead of `writeable`/`writable` due to alternative spelling for the second.

```
class DevConfig(Config):
    # ...
    TRANSIENT_MUTABLE_DB_PATH = os.path.join(WEBAPP_DATA_DIR, 'transient_mutable.db')
    TRANSIENT_MUTABLE_DATABASE_URI = 'sqlite:///{0}'.format(TRANSIENT_MUTABLE_DB_PATH)
```

Then add the following code in `extensions.py`. This injects the python code during initialization of the SQLAlchemy connection.

```
def attach_databases():
    conn = sqlite3.connect(current_app.config['DB_PATH'])  # db name of initial connection is 'main'
    conn.execute("attach database '{}' as transient_mutable".format(current_app.config['TRANSIENT_MUTABLE_DB_PATH']))
    return conn

# ...

db = SQLAlchemy(engine_options={
    'creator': attach_databases
})
```

## Getting SQLAlchemy to create tables in two databases

We currently have sqlalchemy automatically create tables for us via

```
from depmap.extensions import db
db.create_all()
```

This creates all tables in the 'main' database that is first opened. To create different tables in different databases, we can first mark the table class with a property. This would be better implemented as a decorator

```
class CustomDatasetConfig(db.Model):
    __tablename__ = 'custom_dataset_config'
    __db_name__ = 'transient_mutable'

# would be a better implementation, that effectively does the above
@transient_mutable
class CustomDatasetConfig(db.Model):
    __tablename__ = 'custom_dataset_config'
```

The following method checks for this property, and creates all tables in the appropriate database. This should be used instead for creating tables before loading data into them.

```
from flask_sqlalchemy.model import DefaultMeta
from sqlalchemy import create_engine

def create_split_db_tables():
    ''''
    Heavily copied off of implementations of SQLAlchemy._execute_for_all_tables, replaced with create_all
    '''
    app = db.get_app()

    # discover all tables
    tables_with_classes = db.Model._decl_class_registry  # tables specified like above
    tables_without_classes = db.Model.metadata.tables  # also include any tables that don't have classes. e.g. m2m association tables

    seen_class_table_names = set()

    default_db_tables = []
    transient_mutable_db_tables = []

    # figure out which database each table belongs in
    for key, model in tables_with_classes.items():
        if isinstance(model, DefaultMeta):  # there is one item in the dict, {'_sa_module_registry': <sqlalchemy.ext.declarative.clsregistry._ModuleMarker at 0x114a7c8e0>}, that is not a table
            db_name = getattr(model, '__db_name__', None)
            if db_name is None:
                default_db_tables.append(model.__table__)
            elif db_name == 'transient_mutable':
                transient_mutable_db_tables.append(model.__table__)
            else:
                raise ValueError(db_name)
            seen_class_table_names.add(model.__tablename__)

    for table_name, table in tables_without_classes.items():
        if table_name not in seen_class_table_names:
            default_db_tables.append(table)

    # create tables in main database
    default_db_engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    db.Model.metadata.create_all(bind=default_db_engine, tables=default_db_tables)

    # create tables in second, transient mutable database
    transient_mutable_db_engine = create_engine(app.config['TRANSIENT_MUTABLE_DATABASE_URI'])
    db.Model.metadata.create_all(bind=transient_mutable_db_engine, tables=transient_mutable_db_tables)
```

## Refactor interactive module to split tables with a mix of immutable and transient mutable data.

The tables `NonstandardMatrix`, `RowNonstandardMatrix`, and `ColNonstandardMatrix` are used in the interactive module. They contain a mix of:

1. nonstandard, non-custom dataset loaded during the db load, as specified in various environment files (e.g. `external.py`).
2. nonstandard, custom datasets that users supply after the app is deployed.

The naming of the two is confusing (that the two are conflated as nonstandard) and would in any case be good to better distinguish. Regarding immutable/mutable, 1) is immutable while 2) is transient mutable. These tables would need to be split in order to have them in separate databases. The `nonstandard_utils` module that accesses these tables would need to be mirrored for the new set of tables. `nonstandard_utils` is called in `interactive_utils`, so the split could happen in either module.

## Foreign key relationships between two tables in different databases.

sqlite does not support foreign key constraints between tables across different databases. One can create a foreign key referencing a nonexistent table, but any attempts to insert will fail if the option to enforce foreign keys is turned on (via `PRAGMA foreign_keys=ON`).
That said, sqlalchemy can express relationships in the absence of a db-level foreign key constraint.

This is a normal foreign key relationship, with a db foreign key constraint.

```
dataset_id = Column(db.Integer(), db.ForeignKey('dataset.dataset_id'), nullable=False)
dataset = db.relationship('Dataset', foreign_keys='PreferentiallyEssentialGenes.dataset_id', uselist=False)
```

This expresses a relationship without a db-level foreign key. Note the lack of `db.ForeignKey`, and the specification of `primaryjoin`.

```
attach_id = Column(db.Integer(), nullable=False)
attach = db.relationship("MainDbTable", foreign_keys="ForeignKeyTest.attach_id", primaryjoin='MainDbTable.id == ForeignKeyTest.attach_id', uselist=False)
```

Relationships across tables in the different databases will need to use the second setup. There should be some sort of comment or indicator around code that uses the second setup, that this is an exceptional case that should not be used. We don't want devs to just copy and use the code in the second for a new table, and accidentally create a table that does not enforce foreign keys when they do not mean to do so.

Devs should code in python as if foreign keys are enforced. We should load the database and expect the foreign keys to always be in sync. If they are ever out of sync, this should be 500 error that goes to our error reporting and then fixed, as opposed to something devs should code for and gracefully handle.

SQLAlchemy can create objects with relationships as usual, despite not having a db-level foreign key constraint.

```
# this works fine
db.session.add(ForeignKeyTest(
    value='test',
    attach=MainDbTable(value='asdf')
))
db.session.flush()
```

## Handling a second database file (and potentially separate directory with other transient mutable files)

The flask cli command `recreate_dev_db` should be modified to also delete the transient mutable database.

```
# current
    if os.path.isfile(current_app.config['DB_PATH']):
        os.remove(current_app.config['DB_PATH'])

# should change to
    db_paths = [current_app.config['DB_PATH'], current_app.config['TRANSIENT_MUTABLE_DB_PATH']]
    for path in db_paths:
        if os.path.isfile(path):
            os.remove(path)
```

Deploy processes will also need to be changed, now that a second directory and database is in play. Whenever the immutable database is copied, there should be a reset/re-clearing of the transient mutable data so that the two are always in sync.

## Summary of cost

1. Refactoring interactive to split nonstandard tables and their access methods into custom and non-custom
2. Hooking up SQLAlchemy to connect to two attached databases, and create tables in appropriate databases. Mark tables in the second database.
3. Avoiding confusion so that devs do not copy and use code for constraint-less foreign keys without realizing what it does
4. Changing deploy processes
