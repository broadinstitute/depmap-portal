# Creates a typescript interface definition based on pandantic schema definition from a python file
# Used to ensure front end is aware of what the columns exist based on the definition that we have in python-land

import sys
from pandera import SchemaModel, Column
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("schema_py")
parser.add_argument("var_name")
parser.add_argument("type_name")
parser.add_argument("output_filename")
args = parser.parse_args()

type_name_ = args.type_name
g = dict()
exec(open(args.schema_py, "r").read(), g, g)
schema = g[args.var_name]

columns: dict[str, Column] = schema.columns

prop_types = []
for column in columns.values():
    name = column.name
    if column.nullable:
        name += "?"
    # let's just assume that the type is str. Not
    # really sure the best way to test for that. maybe something
    # like:
    # assert column.dtype.type == dtype("<U")
    # what I really want to test is what is the type when it's serialized to json. Maybe I should
    # test the values post-serialization? But I can't do that in this script
    type_name = "string"
    prop_types.append(f"{name}: {type_name}")

nl = "\n"

with open(args.output_filename, "w") as output_file:
    output_file.write(
        f"""/*
  This script was generated from {args.schema_py} via running:
    {' '.join(sys.argv)}
  
  Do not manually edit this file, but instead edit {args.schema_py} and
  regenerate by running "./install_prereqs.sh"
  
  The purpose of this file is to define a type which enumerates which columns are available from
  the Model.csv file for display purposes. If we add/remove columns from the Model file, we will
  detect those changes by the file won't validate against the schema. Once we've updated the 
  schema, we'll be able to detect any UI dependencies as long as they're typed using {type_name_}.
*/

export interface {type_name_} {{
{"".join([f'  {x}{nl}' for x in prop_types])}}};
    """
    )
