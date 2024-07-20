`CLI_VERSION.txt` is used to synchonize with code in the depmap-deploy repo
It should be incremented with any change that involves a change to the deploy commands

This is a standalone file instead of a flask command so that it can be directly concatenated and only have that output, without the console messages that also occur when running anything with flask

This unfortunately means that the path to this file is hard coded. But hard coding the path enables us to keep this version file together in the directory with the CLI commands
