from __future__ import division

import ast
import socket
import threading
from itertools import groupby
import datetime
import os


from tendo import singleton
me = singleton.SingleInstance() # will sys.exit(-1) if other instance is running

# get script location
# http://stackoverflow.com/questions/4060221/how-to-reliably-open-a-file-in-the-same-directory-as-a-python-script

from os.path import expanduser
home = expanduser("~")


UDP_IP = "nifi.velo.eyc3.com"
UDP_PORT = 5007  # port 5007 is the replay port - it goes directly into MongoDB

sock = socket.socket(socket.AF_INET, # Internet
             socket.SOCK_DGRAM) # UDP

from time import sleep


# def streamBike(bikeset):
#     for line in bikeset:
#         sleep(0.1)
#         sock.sendto(line, (UDP_IP, UDP_PORT))

# we reliably get the file
# http://stackoverflow.com/questions/4060221/how-to-reliably-open-a-file-in-the-same-directory-as-a-python-script
with open(os.path.join(home, 'replay_data/hong_kong/hong_kong.json'),'r') as f:
    dataset = f.read().split('\n')
    dataset = filter(lambda x: 'rmc_speed' in x, dataset)
    # sort the dataset by timestamp
    dataset.sort(key=lambda x: ast.literal_eval(x)["rmc_time"])
    # iterate over every timestamp in the groupby statement
    for timestamp, group in groupby(dataset, lambda x: ast.literal_eval(x)["rmc_time"]):
        for data in group:
            sock.sendto(data, (UDP_IP, UDP_PORT))
        sleep(0.02)
