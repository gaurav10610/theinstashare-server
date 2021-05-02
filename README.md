# instashare-server

It&#39;s a real time communication server which uses socket.io nodejs websocket server as an underlying implementation to route messages between users registered on server.

It also supports multi-process socket server clustering out of the box with all the necessary support required to route messages between users connected to different socket server instances running within separate processes through IPC communication channel between master and worker processes.

Server exposes a handful of rest apis to query state of all the active and registered users on server.   
