import subprocess


def invoke(config):
    subprocess.check_call('smartcomments -g --target data/demo/files', shell=True)
