import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    const token = localStorage.getItem('yami_token') || localStorage.getItem('token');

    if (!token || !user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
        setConnecting(false);
      }
      return;
    }

    setConnecting(true);

    const sock = io('/', {
      auth: { token },
      transports: ['websocket'],
      autoConnect: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    sock.on('connect', () => {
      setConnected(true);
      setConnecting(false);
    });

    sock.on('disconnect', () => {
      setConnected(false);
    });

    sock.on('connect_error', () => {
      setConnecting(false);
    });

    setSocket(sock);

    return () => {
      sock.disconnect();
      setConnected(false);
      setConnecting(false);
    };
  }, [user]);

  const reconnect = useCallback(() => {
    if (socket) {
      socket.connect();
    }
  }, [socket]);

  return (
    <SocketContext.Provider value={{ socket, connected, connecting, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
