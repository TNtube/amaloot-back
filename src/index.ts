import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

function makeId () {
  return Math.random().toString(36).slice(6).slice(0, 6)
}

const httpServer = createServer()

const io = new Server(httpServer, { cors: { origin: '*' } })

type RoomDataType = {pcPlayer: string, mobilePlayer: string}

const roomData = new Map<string, RoomDataType>()

function createRoom (roomId: string, pcPlayer: string) {
  roomData.set(roomId, { pcPlayer, mobilePlayer: '' })
}

function addMobile (roomId: string, mobilePlayer: string): boolean {
  const room = roomData.get(roomId)
  if (room && room.mobilePlayer.length === 0) {
    room.mobilePlayer = mobilePlayer
    return true
  }

  return false
}

io.on('connection', (socket: Socket) => {
  console.log('new connection :', socket.id)
  const roomId = makeId()
  createRoom(roomId, socket.id)

  setTimeout(() => {
    socket.emit('room-id', roomId)
  }, 1000)

  socket.on('disconnect', () => {
    io.of('/' + roomId).to(roomId).emit('message', 'shutdown')
    console.log('disconnect :', socket.id)
  })

  socket.on('message', msg => {
    io.of('/' + roomId).to(roomId).emit('message', msg)
    console.log(`forwarding message from [${socket.id}] to namespace [${roomId}]`)
  })

  socket.on('rotate-module', data => {
    console.log('rotate with ' + JSON.stringify(data))
    io.of('/' + roomId).to(roomId).emit('rotate-module', data)
  })

  socket.on('map-data', data => {
    console.log('map data with ' + JSON.stringify(data))
    io.of('/' + roomId).to(roomId).emit('map-data', data)
  })

  socket.on('game-over', data => {
    console.log('game-over with ' + JSON.stringify(data))
    io.of('/' + roomId).to(roomId).emit('map-data', data)
  })

  socket.on('game-over', data => {
    console.log('game-over with ' + JSON.stringify(data))
    io.of('/' + roomId).to(roomId).emit('game-over', data)
  })

  socket.on('lever-activate', data => {
    console.log('lever-activate with ' + JSON.stringify(data))
    io.of('/' + roomId).to(roomId).emit('lever-activate', data)
  })
})

io.of(/^\/\w+$/).on('connection', (socket: Socket) => {
  const namespace = socket.nsp.name.substring(1)
  const room = roomData.get(namespace)
  console.log(socket.id, 'try to join', namespace)
  const owner = io.sockets.sockets.get(room?.pcPlayer ?? '')
  if (!room || !owner) {
    socket.emit('404')
    console.log('404, room not found :', namespace)
    socket.disconnect()
    return
  }
  console.log('Room found !')
  owner.emit('client-connected')
  addMobile(namespace, socket.id)
  socket.join(namespace)

  socket.on('message', msg => {
    const obj = JSON.parse(msg)
    const ev = obj.event
    delete obj.event
    io.sockets.sockets.get(room.pcPlayer)?.emit(ev, obj)
    console.log(`forwarding message from [${socket.id}] to pcPlayer [${room.pcPlayer}]`)
  })

  socket.on('rotate-module', data => {
    io.sockets.sockets.get(room.pcPlayer)?.emit('rotate-module', data)
  })

  socket.on('rotate-module', () => {
    io.sockets.sockets.get(room.pcPlayer)?.emit('malus')
  })

  socket.on('disconnect', () => {
    console.log(`mobilePlayer [${socket.id}] disconnected from namespace [${namespace}]`)
  })
})

const port = 4000
// httpServer.listen(port, 'localhost', () => { console.log(`listening on *:${port}`) })
httpServer.listen(port, '0.0.0.0', () => { console.log(`listening on *:${port}`) })
