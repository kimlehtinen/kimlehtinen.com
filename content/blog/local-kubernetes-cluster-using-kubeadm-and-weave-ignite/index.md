---
title: "Local Kubernetes cluster using kubeadm and Weave Ignite"
date: 2022-03-09T11:07:10+03:00
categories: ["Kubernetes"]
tags: ["Kubernetes", "Kubeadm", "Ignite"]
description: "How to create a three node Kubernetes cluster using kubeadm and Weave Ignite firecracker VMs"
draft: false
comments: false
images:
- "featured_image.webp"
---

As someone who is just learning Kubernetes, I want a local cluster where I can learn the basics of Kubernetes by testing and breaking things! I have lately been testing different tools for creating local kubernets clusters, and there are many good tools for doing so. However, many of them only spin up a single node cluster, I wanted multiple nodes. In addition, many tools make it difficult to control the amount of ram and cpu in each node.

Kubeadm makes it quite easy to setup a multi-node cluster, and I have tried to use it with Vagrant VMs. This setup worked quite well actually, but the downside of Vagrant is that takes long to spin up the cluster, and it takes a lot of resources. Being used to running applications rapidly in Docker containers, it was difficult to find patience for spinning up Vagrant + kubeadm clusters.

Luckily I found that Weave Ignite was the perfect tool for my use case! Ignite makes it easy to spin up VMs fast, and it has nice user experience that reminds a lot of Docker! This made it perfect for someone like me who has used Docker for a long time for different development environments. Ignite uses Firecracker MicroVMs that are super fast to create. This was perfect for me who wanted lightweight fast VMs to create a local cluster.

I threw together some bash scripts to create a 3-node kubernetes cluster using Weave Ignite and kubeadm. This shouldn’t be used in production, these scripts are just something I threw together to test if Ignite is something that can be used. Bash/shell scripting is also new to me, I’m sure there are a lot of improvements that can be made.

Note: Ignite needs to be run as root user, make sure all commands and scripts are run as root. In addition, Ignite can only be used on Linux!

```bash
sudo -i
```

Big credit goes to justmeandopensource, he has created several tutorials on how setup a local kubeadm cluster. Node shell scripts are partially taken from his great tutorials found here. Also, this tutorial by Weave Ignite was also helpful.

Let’s start with a shell script called common.sh. This installs all the software required in each node, both master and worker nodes. This will install containerd, kubeadm, kubelet, kubectl etc.

```bash
#!/bin/bash
# source code partially from https://github.com/justmeandopensource/kubernetes
echo "install containerd"
apt update -qq >/dev/null 2>&1
apt install -qq -y containerd apt-transport-https >/dev/null 2>&1
mkdir /etc/containerd
containerd config default > /etc/containerd/config.toml
systemctl restart containerd
systemctl enable containerd >/dev/null 2>&1
echo "add apt k8s"
curl -s https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key add - >/dev/null 2>&1
apt-add-repository "deb http://apt.kubernetes.io/ kubernetes-xenial main" >/dev/null 2>&1
echo "install kubeadm, kubelet and kubectl"
apt install -qq -y kubeadm=1.20.0-00 kubelet=1.20.0-00 kubectl=1.20.0-00 >/dev/null 2>&1
echo 'KUBELET_EXTRA_ARGS="--fail-swap-on=false"' > /etc/default/kubelet
systemctl restart kubelet
echo "enable ssh password auth"
sed -i 's/^PasswordAuthentication .*/PasswordAuthentication yes/' /etc/ssh/sshd_config
echo 'PermitRootLogin yes' >> /etc/ssh/sshd_config
systemctl reload sshd
echo "set root password"
echo -e "kubeadmin\nkubeadmin" | passwd root >/dev/null 2>&1
echo "export TERM=xterm" >> /etc/bash.bashrc
echo "install net-tools"
apt install -qq -y net-tools >/dev/null 2>&1
```

Master nodes gets its own master.sh script, where we create the kubeadm cluster and apply Weave networking. In addition, this script create a join.sh script that worker nodes can use to join.

```bash
#!/bin/bash
# source code partially from https://github.com/justmeandopensource/kubernetes
echo "pull config images"
kubeadm config images pull >/dev/null 2>&1
echo "init k8s cluster"
kubeadm init --pod-network-cidr=10.244.0.0/16 --ignore-preflight-errors=all >> /root/kubeinit.<em>log</em> 2>&1
echo "cp config to .kube"
<em>mkdir</em> /root/.kube
cp /etc/kubernetes/admin.conf /root/.kube/config  
echo "install weave"
kubectl apply -f "https://cloud.weave.works/k8s/net?k8s-version=$(kubectl version | base64 | tr -d '\n')"
echo "save join sh file"
JOIN_COMMAND=$(kubeadm token create --print-join-command 2>/dev/null) 
echo "$JOIN_COMMAND --ignore-preflight-errors=all" > /join.sh
```

The worker nodes also get their own additional shell script called worker.sh, where we join the nodes

```bash
#!/bin/bash
# source code partially taken from https://github.com/justmeandopensource/kubernetes
# load $MASTER_IP that was copied from host to vm
source master_ip.sh
echo "join"
apt install -qq -y sshpass >/dev/null 2>&1
sshpass -p "kubeadmin" scp -o UserKnownHostsFile=/dev/null -o StrictHostKeyChecking=no $MASTER_IP:/join.sh /join.sh 2>/tmp/joincluster.<em>log</em>
bash /join.sh >> /tmp/joincluster.<em>log</em> 2>&1
```

Finally, we create the main shell script file called install.sh. Here we use Ignite cli to create one master node and two worker nodes. On each node we run the common.sh script, and after this node specific scripts.

```bash
#!/bin/bash
# Create master node
echo "Creating ignite master node..."
ignite run weaveworks/ignite-kubeadm:latest \
        --cpus 2 \
        --memory 2GB \
        --ssh \
        --name master
echo "Master node is running"
export MASTER_IP=$(ignite inspect vm master | jq -r ".status.network.ipAddresses[0]")
echo "export MASTER_IP=$MASTER_IP" > master_ip.sh
# Create n x workers 
echo "Creating ignite worker nodes..."
for i in {1..2}; do
        ignite run weaveworks/ignite-kubeadm:latest \
                --cpus 2 \
                --memory 1GB \
                --ssh \
                --name worker${i}
done
echo "Worker nodes are running"
echo "All nodes are running"
# Configure master
echo "Configuring master..."
cat common.sh | ignite exec master bash
cat master.sh | ignite exec master bash
# Configure workers
echo "Configuring workers..."
for i in {1..2}; do
        ignite cp master_ip.sh worker${i}:/root/master_ip.sh
        cat common.sh | ignite exec worker${i} bash
        cat worker.sh | ignite exec worker${i} bash
done
```

Whenever you are ready, run the main script!

```bash
chmod +x install.sh && ./install.sh
```

check the Ignite VMs

```bash
root@latitude:/home/kle/projects/kubeadm-ignite# ignite ps
VM ID            IMAGE                    KERNEL                    SIZE    CPUS    MEMORY        CREATED        STATUS        IPS        PORTS    NAME
2166bb876082c0d5    weaveworks/ignite-kubeadm:latest    weaveworks/ignite-kernel:4.19.1254.0 GB    2    1024.0 MB    6m9s ago    Up 6m9s        10.61.0.42        worker1
ace841b9057e9117    weaveworks/ignite-kubeadm:latest    weaveworks/ignite-kernel:4.19.1254.0 GB    2    2.0 GB        6m14s ago    Up 6m14s    10.61.0.41        master
c38cd0c0ba385be7    weaveworks/ignite-kubeadm:latest    weaveworks/ignite-kernel:4.19.1254.0 GB    2    1024.0 MB    6m5s ago    Up 6m5s        10.61.0.43        worker2
```

ssh into master

```bash
root@latitude:/home/kle/projects/kubeadm-ignite# ignite ssh master
Welcome to Ubuntu 18.04.4 LTS (GNU/Linux 4.19.125 x86_64)
 * Documentation:  https://help.ubuntu.com
 * Management:     https://landscape.canonical.com
 * Support:        https://ubuntu.com/advantage
This <em>system</em> <em>has</em> been minimized by removing packages <em>and</em> content that are
not required on a <em>system</em> that users do not <em>log</em> into.
To restore this content, you can run the 'unminimize' command.
```

check nodes

```bash
root@ace841b9057e9117:~# kubectl get nodes
NAME               STATUS   ROLES                  AGE     VERSION
2166bb876082c0d5   Ready    <none>                 2m29s   v1.20.0
ace841b9057e9117   Ready    control-plane,master   3m39s   v1.20.0
c38cd0c0ba385be7   Ready    <none>                 76s     v1.20.0
```

That’s it, we have a working cluster now! I will be using this cluster to learn more about Kubernetes 🙂 Next I will reasearch how to install ingress and metallb load balancer, maybe I will write a blog post about that also.

Source code can be found here <a href="https://github.com/kimlehtinen/kubeadm-ignite" target="_blank">https://github.com/kimlehtinen/kubeadm-ignite</a>
