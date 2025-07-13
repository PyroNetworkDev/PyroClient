'use strict';

class Logger2 {
  constructor(identifier, color, fileLogger = null, consoleWindow = null){
    this.identifier = identifier;
    this.color = color;
    this.console = console;
    this.fileLogger = fileLogger;
    this.consoleWindow = consoleWindow;
  }

  log(...text) {
    this.emit("log", ...text);
  }

  info(...text) {
    this.emit("info", ...text);
  }

  warn(...text) {
    this.emit("warn", ...text);
  }

  debug(...text) {
    this.emit("debug", ...text);
  }

  error(...text) {
    this.emit("error", ...text);
  }

  func = [];

  setFileLogger(fileLogger) {
    this.fileLogger = fileLogger;
  }

  setConsoleWindow(consoleWindow) {
    this.consoleWindow = consoleWindow;
  }

  on(event, func){
    if(!this.func[event]) this.func[event] = [];
    this.func[event].push(func);
  }

  off(event, func){
    if(!this.func[event]) return;
    this.func[event] = this.func[event].filter(f => f !== func);
  }

  emit(event, ...args){
    // Log a la consola del navegador
    this.console[event](`%c[${this.identifier}]`, `color: ${this.color};`, ...args);
    
    // Normalizar el evento
    const normalizedEvent = event === "log" ? "info" : event;
    
    // Solo enviar a la ventana de consola, no al archivo directamente
    // El archivo se maneja a través del handler 'log-message' en app.js
    if (this.consoleWindow && this.consoleWindow.isReady && this.consoleWindow.isReady()) {
      try {
        this.consoleWindow.sendLog({
          type: normalizedEvent,
          args: args,
          timestamp: new Date(),
          identifier: this.identifier
        });
      } catch (error) {
        this.console.error('Error sending to console window:', error);
      }
    }
    
    // Ejecutar listeners registrados
    if(this.func[normalizedEvent]){
      for(let func of this.func[normalizedEvent]){
        try {
          func(...args);
        } catch (error) {
          this.console.error('Error in logger event listener:', error);
        }
      }
    }
  }
}

export default Logger2