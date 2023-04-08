#!bin/bash
#step 1 - node setup
tar -xf node_16_14.tar.xz
node_bin=`readlink -f node-v16.14.0-linux-x64/bin`;
pathText='$PATH'
echo "#!bin/bash" | sudo tee nodejs_p4d.sh;
echo "export PATH=$node_bin:$pathText" | sudo tee -a nodejs_p4d.sh;

#step 2 - perforce setup
sudo rpm --import perforce.pubkey;
sudo yum install helix-p4d;

p4Path=`locate /perforce/p4`;
echo "export PATH=/opt/perforce:$pathText" | sudo tee -a nodejs_p4d.sh;

sudo cp nodejs_p4d.sh /etc/profile.d/nodejs_p4d.sh;
sudo cp .npmrc /users/gen/dexpwrk1
exec bash --login | echo "setup sh operation done so now please run project_init.sh";

