This directory contains a minimal example of how to use a custom docker
file with conseq.

the `docker` directory contains a `Dockerfile` which installs the software
that conseq will need to work with the image. You can build this image by
running the `build_image.sh` script.

Then in `sample.conseq` is a sample rule which will use dsub to run a
command using that docker image. It does this by defining an execution
profile for using this docker image.
