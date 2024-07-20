from urllib.parse import unquote
from flask import url_for
import re


def js_url_for(endpoint, **values):
    """
    In the entire url, any chars within {} curly braces is replaced with a javascript variable of the same name	

    unquote: Unencode anything between encoded curly braces (inclusive),
    e.g. %7Bdata%7D -> {data} and %7Brow%5B0%5D%7D -> {row[0]} 
[1:-1]: Replace the curly braces with '+ and +'
    e.g. {data} -> '+data+' and {row[0]} -> '+row[0]+'
Returns a string of js that is strings concatenated with variables.
    """
    encoded_string = url_for(endpoint, **values)
    unencoded_js_variables = re.sub(
        "%7B(.*?)%7D", lambda x: "'+" + unquote(x.group())[1:-1] + "+'", encoded_string
    )
    js_string = "'{}'".format(unencoded_js_variables)
    return js_string
