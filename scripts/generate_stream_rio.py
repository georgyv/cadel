from __future__ import division

import ast
import glob
import socket
import threading
from itertools import groupby
import datetime
import os

from dateutil import parser
from tendo import singleton

me = singleton.SingleInstance()  # will sys.exit(-1) if other instance is running

# get script location
# http://stackoverflow.com/questions/4060221/how-to-reliably-open-a-file-in-the-same-directory-as-a-python-script

from os.path import expanduser

home = expanduser("~")

UDP_IP = "52.65.187.71"
UDP_PORT = 5007  # port 5007 is the replay port - it goes directly into MongoDB

sock = socket.socket(socket.AF_INET,  # Internet
                     socket.SOCK_DGRAM)  # UDP

from time import sleep

# The number of rows to send per rider per second
speed_up = 8

# When the row number is divisible by this number it will be sent, all other rows will be ignored (used to speed up the race)
sendNthRows = 2

import fileinput

# def streamBike(bikeset):
#     for line in bikeset:
#         sleep(0.1)
#         sock.sendto(line, (UDP_IP, UDP_PORT))

# we reliably get the file
# http://stackoverflow.com/questions/4060221/how-to-reliably-open-a-file-in-the-same-directory-as-a-python-script


root_path = os.path.join('/home/ec2-user', 'replay_data/rio')
# root_path = os.path.join("C:/Users/maarest/Desktop/rio2")
os.chdir(root_path)
filenames = []
for filename in glob.glob("*.csv"):
    filenames.append(filename)

f = fileinput.input(filenames)

print("reading")
dataset = []
for line in f:
    # csv data so we split by comma
    dataset.append(line.replace('"','').replace('\n','').replace('\r','').split(","))

send_rate = 1 / speed_up

f.close()
# sort the dataset by timestamp
print("sorting")
dataset.sort(key=lambda x: x[1])
# iterate over every timestamp in the groupby statement
print("grouping")
groups = groupby(dataset, lambda x: x[1])
print("sending")

packet_counter = 0

# transform the latitude and longitude to gps generated latitude and longitude
# (necessary to match other stream of the project)
def to_nmea(lat, lon):
    int_lat = int(lat)
    dec_lat = (lat - int_lat) * 60
    int_lon = int(lon)
    dec_lon = (lon - int_lon) * 60
    final_lat = (int_lat * 100 + dec_lat)
    final_lon = (int_lon * 100 + dec_lon)
    sign_lat = "N" if final_lat > 0 else "S"
    sign_lon = "E" if final_lon > 0 else "W"
    return (abs(final_lat), sign_lat, abs(final_lon), sign_lon)

# formatting function to guarantee number of 0s left of the comma
def zpad(val, n):
    bits = str(val).split('.')
    return "%s.%s" % (bits[0].zfill(n), bits[1])

# transform the csv to json data
def csv_to_json(data):
    bike_id = data[0]
    time_row = data[1].replace(":", "") + ".00"
    latitude = float(data[2])
    longitude = float(data[3])
    final_lat, sign_lat, final_lon, sign_lon = to_nmea(latitude, longitude)
    date_row = "240616"  # dummy date
    elevation = data[4]
    perc_compl = data[5]
    rank = data[6]
    dist_frm_start_km = data[7]
    dist_frm_first_rider_km = data[8]
    time_to_first = data[9]
    speed = data[10]
    cadence = data[11]
    power = data[12]
    heart_rate = data[13]
    ei = data[14]

    output = {
        "bike_id": bike_id,
        "ride_id": "0001",
        "packet_counter": packet_counter,
        "rmc_time": time_row,
        "rmc_status": "A",
        "rmc_latitude": zpad(final_lat, 4),
        "rmc_northings": sign_lat,
        "rmc_longitude": zpad(final_lon, 5),
        "rmc_eastings": sign_lon,
        "rmc_date": date_row,
        "gga_antenna_altitude_geoid": elevation,
        "custom_perc_compl": perc_compl,
        "custom_rank": rank,
        "custom_dist_start_km": dist_frm_start_km,
        "custom_dist_first_fm": dist_frm_first_rider_km,
        "custom_time_to_first": time_to_first,
        "rmc_speed": speed,
        "custom_cadence": cadence,
        "custom_power": power,
        "hr": heart_rate,
        "ei" : ei
    }
    return str(output)


# rider_ID	time_stamps	lat	lon	ele	perc_comp	rank_wrt_timestamp	dist_frm_start_km	dist_frm_first_rider_km
# 4039666	0:00:01	-22.92304	-43.17132	7	0	172	0	0


def generate_missing(previous,current):
    new_points = []
    mess = previous
    perc_prev = float(previous[5])
    perc_curr = float(current[5])
    # exit clause if we have reached the end of the race
    if (perc_prev==100):
        return [previous]
    t_previous = parser.parse(previous[1])
    t_current = parser.parse(current[1])
    delta = t_current - t_previous
    lat_prev, lon_prev, alt_prev = float(previous[2]), float(previous[3]), float(previous[4])
    lat_curr, lon_curr, alt_curr = float(current[2]), float(current[3]), float(previous[4])
    speed_prev, cadence_prev, power_prev, heart_rate_prev = float(previous[10]), int(previous[11]), int(previous[12]), int(previous[13])
    speed_curr, cadence_curr, power_curr, heart_rate_curr = float(current[10]), int(current[11]), int(current[12]), int(current[13])
    total_seconds = delta.total_seconds()
    # all the points but the last one
    for i in range(int(total_seconds)):
        if (i % sendNthRows == 0):
            new_row = list(previous)
            t_i = t_previous + datetime.timedelta(seconds=i)
            percent = i / total_seconds
            new_row[1] = t_i.strftime("%H:%M:%S")
            new_row[2] = lat_prev * (1-percent) + lat_curr * percent
            new_row[3] = lon_prev * (1-percent) + lon_curr * percent
            new_row[4] = str(alt_prev * (1-percent) + alt_curr * percent)
            new_row[5] = str(perc_prev * (1-percent) + perc_curr * percent)
            new_row[10] = str(round(speed_prev * (1-percent) + speed_curr * percent,1))
            new_row[11] = str(int(cadence_prev * (1-percent) + cadence_curr * percent))
            new_row[12] = str(int(power_prev * (1-percent) + power_curr * percent))
            new_row[13] = str(int(heart_rate_prev * (1-percent) + heart_rate_curr * percent))
            new_points.append(new_row)
    return new_points


dict_of_bikes = { "new": {}, "old": {}}

for timestamp, group in groups:
    # date = ""
    # assign the new values to the old
    dict_of_bikes["old"]=dict(dict_of_bikes["new"])
    for data in group:
        packet_counter += 1
        # find the new values
        dict_of_bikes["new"][data[0]] = data
    # generate the missing points
    to_send = []
    for bike_id, new_data in dict_of_bikes["new"].items():
        if bike_id in dict_of_bikes["old"].keys():
            to_send += generate_missing(dict_of_bikes["old"][bike_id],new_data)
        # csv_to_json(data)
        # date = data[1]
    to_send.sort(key=lambda x: x[1])
    groups_new = groupby(to_send, lambda x: x[1])
    for timestamp_new, group_new in groups_new:
        # print(timestamp_new)
        for data_new in group_new:
            sock.sendto(csv_to_json(data_new), (UDP_IP, UDP_PORT))
            # print(csv_to_json(data_new))
        sleep(send_rate)
