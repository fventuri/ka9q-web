# ka9q-web

A web interface for ka9q-radio by John Melton G0ORX


## How to build ka9q-web

### 1 - Build and install ka9q-radio

- `git clone https://github.com/ka9q/ka9q-radio.git`
- detailed instructions are here: https://github.com/ka9q/ka9q-radio/blob/main/docs/INSTALL.md


### 2 - Install the prerequisites for the Onion framework: GnuTLS and libgcrypto

The Onion framework requires GnuTLS and libgcrypto to compute the SHA1 checksum required by WebSockets.
They can be installed as follows:

- on Ubuntu, Debian, and similar Linux distributions:
```
sudo apt install gnutls-dev libgcrypto-dev
```

- on RedHat, CentOS, Fedora and similar Linux distributions:
```
sudo dnf install gnutls-devel libgcrypto-devel
```


### 3 - Build and install the Onion framework

```
git clone https://github.com/davidmoreno/onion
cd onion
mkdir build
cd build
cmake -DONION_USE_SSL=false ..
make
sudo make install
sudo ldconfig
```


### 4 - Build and install ka9q-web

- edit the first line of `Makefile` to point to the directory where you built ka9q-radio
- run:
```
make
sudo make install
sudo make install-config    (it will install rx888-web.conf in /etc/radio)
```


## How to run ka9q-web

1. make sure ka9q-radio is running using the configuration rx888-web:
```
sudo systemctl start radiod@rx888-web
systemctl status radiod@rx888-web
```
Address any problem with radiod before going to the next step

2. start ka9q-web
```
ka9q-web
```

Finally open a browser and connect locally to http://localhost:8081 , or from a remote browser to http://<your computer name/IP>:8081

## References

- [John Melton G0ORX fork of ka9q-radio](https://github.com/g0orx/ka9q-radio)
- [Phil Karn KA9Q ka9q-radio](https://github.com/ka9q/ka9q-radio)

## Copyright

(C) 2023-2024 John Melton G0ORX - Licensed under the GNU GPL V3 (see [LICENSE](LICENSE))
