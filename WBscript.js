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

//ASI Modbus parameters
var codeLength = 6;
var address = 1; //address the slave unit address. do not modify
var code = 3; //the function to call next.
var dataAddress = 265; //Data Address of the first register.
var length = 6; //total number of registers requested.

//Use Ethereum array buffer library for testing
var buf = ethereumjs.Buffer.Buffer.alloc(codeLength + 2); // add 2 crc bytes
buf.writeUInt8(address, 0);
buf.writeUInt8(code, 1);
buf.writeUInt16BE(dataAddress, 2);
buf.writeUInt16BE(length, 4);
// add crc bytes to buffer
buf.writeUInt16LE(crc16(buf.slice(0, -2)), codeLength);

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
    console.error(error);
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
  let lengthArray = value.byteLength;

 
  let dataArray = [];
  let arrayIndex = 0;

  for (let i = 0; i < lengthArray; i += 1) {    
    
    if (i % 2==0) {
      console.log('skip');
    } else if (i > 2) {
      dataArray[arrayIndex] = value.getInt16(i);
      arrayIndex += 1;
    }    
  } 

  console.log(dataArray);

  let voltage = dataArray[0]/32;
  let current = dataArray[1]/32;
  let power = dataArray[3];
  let throttle = dataArray[5]/4096;

  console.log(voltage, current, power, throttle);
      
  document.getElementById("voltage").innerHTML = voltage;
  document.getElementById("amperage").innerHTML = current;
  document.getElementById("throttle").innerHTML = throttle;

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
