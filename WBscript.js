const connectButton = document.getElementById("connectButton");
const writeButton = document.getElementById("writeButton");
const stopButton = document.getElementById("stopButton");
const disconnectButton = document.getElementById("disconnectButton");
const connectionStatus = document.getElementById("connectionStatus");

connectButton.addEventListener("click", onStartButtonClick);
writeButton.addEventListener("click", onWriteButtonClick);
stopButton.addEventListener("click", onStopButtonClick);
disconnectButton.addEventListener("click", onDisconnectButtonClick);

/*
 * ASI Modbus parameters used for testing:
 * Battery Voltage: address 265, scale 32
 * Battery Current (amps): address 266, scale 32
 * Throttle voltage: address 270, scale 4096
 */

//Read Request - ASI Modbus parameters
var address = 1; //Slave ID. do not modify
var code = 3; //Function code for read request 0x03
var dataAddress = 265;
var length = 6;
var codeLength = 6; //variable used for crc code  

//Testing--------------
var buffer = new ArrayBuffer(codeLength + 2);
var view = new DataView(buffer);

view.setInt8(0, address);
view.setInt8(1, code);
view.setInt16(2, dataAddress);
view.setInt16(4, length);
view.setInt16(6, crc16(view));

var uintArray = new Uint8Array( buffer , 0 , codeLength + 2 );

//sample slice code **** 
// const sliced = new Uint8Array(buffer.slice(4, 12));
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer/slice

// uintArray = new Uint8Array( buffer , byteOffset , length );
var uintArray = new Uint8Array( buffer , 0 , codeLength + 2 );

console.log("test");
console.log(uintArray);

console.log("View..."); 
console.log(buffer);

//Testing--------------

//Use Ethereum array buffer library for testing
var buf = ethereumjs.Buffer.Buffer.alloc(codeLength + 2); // add 2 crc bytes
buf.writeUInt8(address, 0);
buf.writeUInt8(code, 1);
buf.writeUInt16BE(dataAddress, 2);
buf.writeUInt16BE(length, 4);
// add crc bytes to buffer
buf.writeUInt16LE(crc16(buf.slice(0, -2)), codeLength);

var testSlice = buf.slice(0, -2);
console.log("testSlice");
console.log(testSlice);

console.log("buffer: ");
console.log(buf);

var myService;
var myCharacteristic;
var bluetoothDevice;
var device;
var data;

//Connects to GATT server and starts notifications
async function onStartButtonClick() {
    bluetoothDevice = null;
  
    console.log("Requesting Bluetooth Device...");
    connectionStatus.textContent = "Requesting Bluetooth Device...";
    
    device = await navigator.bluetooth
      .requestDevice({
        filters: [{ services: ["6e400001-b5a3-f393-e0a9-e50e24dcca9e"] }],
      })
      .then((device) => {
        bluetoothDevice = device;
        console.log("Connecting to GATT Server...");
        connectionStatus.textContent = "Connecting to GATT Server...";
        return device.gatt.connect();
      })
      .then((server) => {
        console.log("Getting Service...");
        connectionStatus.textContent = "Getting Service...";
        return server.getPrimaryService("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
      })
      .then((service) => {
        myService = service;
        console.log("Getting Characteristic...");
        connectionStatus.textContent = "Getting Characteristic...";
        return myService.getCharacteristic("6e400003-b5a3-f393-e0a9-e50e24dcca9e");
      })   
      .then((characteristic) => {
        myCharacteristic = characteristic;
        return myCharacteristic.startNotifications().then((_) => {
          console.log("> Notifications started");
          connectionStatus.textContent = "> Notifications started";
          myCharacteristic.addEventListener(
            "characteristicvaluechanged",
            handleNotifications
          );
        });
      })
      .catch((error) => {
        console.log("Argh! " + error);
      });
  }

//Writes modbusData to ASI via Bluetooth 
async function onWriteButtonClick() {
  console.log("Requesting Bluetooth Device...");
  
  const modbusData = buf; //Uint8Array.of(1, 3, 0, 0, 0, 3, 5, 203);
  console.log("buffer:");
  console.log(modbusData);
  
  try {
    const data = await myService.getCharacteristic("6e400002-b5a3-f393-e0a9-e50e24dcca9e")
      data.writeValue(modbusData);
  } catch (error) {
    console.log(error);
  }
  
}

//Stops bluetooth notifications
function onStopButtonClick() {
  if (myCharacteristic) {
    myCharacteristic
      .stopNotifications()
      .then((_) => {
        console.log("> Notifications stopped");
        connectionStatus.textContent = "> Notifications stopped";
        myCharacteristic.removeEventListener(
          "characteristicvaluechanged",
          handleNotifications
        );
      })
      .catch((error) => {
        console.log("Argh! " + error);
      });
  }
}

//Unpacks modbus data received via bluetooth LE
function handleNotifications(event) {
  console.log("handling...");
  connectionStatus.textContent = "handling...";
  
  let value = event.target.value;
  
  console.log(value);
  console.log(value.getInt16(3, false)/32); //volts
  console.log(value.getInt16(5, false)/32); //amps
  console.log(value.getInt16(7, false)/1);  //battery state of charge %
  console.log(value.getInt16(9, false)/1); //power in watts
  console.log(value.getInt16(11, false)); //Last Fault Bit Array
  console.log(value.getInt16(13, false)/4096); //throttle voltage
 
  let voltage = value.getInt16(3, false)/32;
  let current = value.getInt16(5, false)/32;
  let charge = value.getInt16(7, false)/1;
  let power = value.getInt16(9, false)/1;
  let lastFault = value.getInt16(11, false)/1;
  let throttle = value.getInt16(13, false)/4096;
      
  document.getElementById("voltage").innerHTML = voltage;
  document.getElementById("amperage").innerHTML = current;
  document.getElementById("throttle").innerHTML = throttle;
  document.getElementById("power").innerHTML = power;
  document.getElementById("charge").innerHTML = charge;
  document.getElementById("lastFault").innerHTML = lastFault;

}

function onDisconnectButtonClick() {
  console.log("Disconnecting from Bluetooth Device...");
  connectionStatus.textContent = "Disconnecting from Bluetooth Device...";
  if (bluetoothDevice.gatt.connected) {
    bluetoothDevice.gatt.disconnect();
  } else {
    console.log("> Bluetooth Device is already disconnected");
    connectionStatus.textContent = "> Bluetooth Device is already disconnected";
  }
}
