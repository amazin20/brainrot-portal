from pathlib import Path
root=Path.cwd()
p=root/'src/game/InputController.js';s=p.read_text()
s=s.replace('constructor({ joystick, joystickKnob, jumpButton }) {','constructor({ joystick, joystickKnob, jumpButton, isActive = () => true }) {\n    this.isActive = isActive;\n    this.disposed = false;')
s=s.replace('this.onKeyDown = (event) => {','this.onKeyDown = (event) => {\n      if (this.disposed || !this.isActive()) return;\n      // A held key must be released and pressed again after a reset.\n      if (event.repeat && !this.keys.has(event.code)) return;')
s=s.replace('  dispose() {\n','  dispose() {\n    if (this.disposed) return;\n    this.disposed = true;\n')
s=s.replace("if (this.joystickPointer !== null) return;", "if (this.disposed || !this.isActive() || this.joystickPointer !== null) return;")
s=s.replace('      this.joystick.setPointerCapture?.(event.pointerId);','      try { this.joystick.setPointerCapture?.(event.pointerId); }\n      catch (error) {\n        this.resetStick();\n        if (![\'NotFoundError\', \'InvalidStateError\'].includes(error.name)) throw error;\n        return;\n      }')
s=s.replace("this.listen(this.joystick, 'pointermove', (event) => {", "this.listen(this.joystick, 'pointermove', (event) => {\n      if (this.disposed || !this.isActive()) { this.resetStick(); return; }")
s=s.replace("this.listen(this.jumpButton, 'pointerdown', (event) => {", "this.listen(this.jumpButton, 'pointerdown', (event) => {\n      if (this.disposed || !this.isActive()) return;")
s=s.replace('  getMove() {\n','  getMove() {\n    if (this.disposed || !this.isActive()) return new THREE.Vector2();\n')
s=s.replace('return queued; }', 'return queued && !this.disposed && this.isActive(); }')
p.write_text(s)
p=root/'src/game/LabGame.js';s=p.read_text()
s=s.replace("import { InputController } from './InputController.js';", "import { InputController } from './InputController.js';\nimport { LabControls } from './LabControls.js';")
s=s.replace("import { LabCamera, CAMERA_PITCH_MIN, CAMERA_PITCH_MAX }", "import { LabCamera }")
s=s.replace('constructor({ container, touch, onProgress', 'constructor({ container, touch, debug = false, onProgress')
s=s.replace('    this.container = container; this.touch = touch;', '    this.container = container; this.touch = touch; this.debug = debug;')
s=s.replace('this.input = new InputController(this.touch);', "this.input = new InputController({ ...this.touch, isActive: () => this.state === 'playing' && !this.externalBlocked });")
start=s.index('  setupControls() {');end=s.index('\n  isActiveBlocker(object)',start)
s=s[:start]+'''  setupControls() {
    this.controls?.dispose();
    this.controls = new LabControls(this);
  }

  resetInput() {
    if (this.input?.reset) this.input.reset();
    else this.input?.keys.clear(); // Small physics fixtures supply only keys.
    this.controls?.reset();
    this.interactQueued = false; this.jumpBuffer = 0;
  }

  disposeControls() {
    this.resetInput();
    this.controls?.dispose(); this.input?.dispose();
  }
''' +s[end:]
s=s.replace("this.state = 'loading'; this.renderer?.setAnimationLoop(null); this.input?.keys.clear();", "this.state = 'loading'; this.renderer?.setAnimationLoop(null); this.resetInput();")
s=s.replace('    this.input?.keys.clear(); this.accumulator = 0;', '    this.resetInput(); this.accumulator = 0;')
s=s.replace('    this.input.keys.clear(); this.lastFrame', '    this.resetInput(); this.lastFrame')
s=s.replace("if ((this.state === 'paused') === paused) { if (paused)", "if ((this.state === 'paused') === paused) { this.resetInput(); if (paused)")
s=s.replace('while (this.accumulator + 1e-10 >= FIXED_STEP)', "while (this.state === 'playing' && !this.externalBlocked && this.accumulator + 1e-10 >= FIXED_STEP)")
s=s.replace("      button.addEventListener('pointerdown', e => { e.preventDefault(); action(); }); mobile.appendChild(button);", "      this.controls.listen(button, 'pointerdown', e => { e.preventDefault(); if (this.controls.active) action(); }); mobile.appendChild(button);")
s=s.replace("    this.fpsElement = document.createElement('output'); this.fpsElement.className = 'lab-fps'; this.fpsElement.setAttribute('aria-label', 'Частота кадров'); document.body.appendChild(this.fpsElement);", "    if (this.debug) {\n      this.fpsElement = document.createElement('output'); this.fpsElement.className = 'lab-fps'; this.fpsElement.setAttribute('aria-label', 'Частота кадров'); document.body.appendChild(this.fpsElement);\n    }")
s=s.replace('if (this.fpsElement && now - (this.lastUiUpdate ?? 0) > 180)', 'if (this.tutorialElement && now - (this.lastUiUpdate ?? 0) > 180)')
s=s.replace('      this.fpsElement.textContent = stats.fps', '      if (this.fpsElement) {\n      this.fpsElement.textContent = stats.fps')
s=s.replace('      const lesson = this.tutorial.update();', '      }\n      const lesson = this.tutorial.update();')
p.write_text(s)
p=root/'src/main.js';s=p.read_text()
start=s.index('function clearInput()');end=s.index('\nfunction syncActivity()',start)
s=s[:start]+'function clearInput(){game.resetInput();}'+s[end:]
s=s.replace("if(on){clearInput();game.accumulator=0;}","clearInput();game.accumulator=0;")
s=s.replace("const game=new LabGame({container:","const game=new LabGame({debug,container:")
s=s.replace("function failure(error){console.error(error);", "function failure(error){console.error(error);clearInput();")
s=s.replace("$('#hint-button').addEventListener('click',showHints);", "$('#hint-button').hidden=!debug;\n$('#hint-button').addEventListener('click',()=>{if(debug)showHints();});")
s=s.replace("addEventListener('contextmenu',event=>event.preventDefault());", "// A bfcache visit keeps the one live controller; a discarded page detaches it.\naddEventListener('pagehide',event=>{hold('page',true);if(!event.persisted){game.renderer?.setAnimationLoop(null);game.disposeControls();platform?.dispose();game.audio?.dispose();}});\naddEventListener('pageshow',event=>{if(event.persisted)hold('page',false);});\naddEventListener('contextmenu',event=>event.preventDefault());")
p.write_text(s)
