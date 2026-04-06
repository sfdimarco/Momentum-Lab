import * as Blockly from 'blockly';
import { FieldColour } from '@blockly/field-colour';
import '@blockly/field-angle';

export function defineCustomBlocks() {
  // Movement Block
  Blockly.Blocks['move_sprite'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Move")
          .appendField(new Blockly.FieldDropdown([["Forward","FORWARD"], ["Backward","BACKWARD"]]), "DIRECTION")
          .appendField("by")
          .appendField(new Blockly.FieldNumber(10), "STEPS")
          .appendField("steps");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Moves the sprite in a direction.");
    }
  };

  // Rotation Block
  Blockly.Blocks['rotate_sprite'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Rotate")
          .appendField(new Blockly.FieldNumber(90, 0, 360), "ANGLE")
          .appendField("degrees");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Sets the sprite's rotation.");
    }
  };

  // Flip Block
  Blockly.Blocks['flip_sprite'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Flip")
          .appendField(new Blockly.FieldDropdown([["Horizontally","HORIZONTAL"], ["Vertically","VERTICAL"]]), "AXIS");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(230);
      this.setTooltip("Flips the sprite horizontally or vertically.");
    }
  };

  // Appearance Block
  Blockly.Blocks['change_appearance'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Change Appearance ✨");
      this.appendDummyInput()
          .appendField("Color:")
          .appendField(new Blockly.FieldDropdown([
            ["Blue", "#3b82f6"],
            ["Red", "#ef4444"],
            ["Green", "#22c55e"],
            ["Yellow", "#eab308"],
            ["Purple", "#a855f7"],
            ["Rainbow 🌈", "RAINBOW"]
          ]), "COLOR");
      this.appendDummyInput()
          .appendField("Size:")
          .appendField(new Blockly.FieldNumber(40, 1, 200), "SIZE");
      this.appendDummyInput()
          .appendField("Effect:")
          .appendField(new Blockly.FieldDropdown([
            ["None", "NONE"],
            ["Fade In", "FADE_IN"],
            ["Fade Out", "FADE_OUT"],
            ["Pulse 💓", "PULSE"],
            ["Flash ⚡", "FLASH"],
            ["Damage 💥", "DAMAGE"],
            ["Shake 🫨", "SHAKE"],
            ["Ghost 👻", "GHOST"]
          ]), "EFFECT");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip("Changes how the sprite looks!");
    }
  };

  // Flash Screen Block
  Blockly.Blocks['flash_screen'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Flash Screen ✨")
          .appendField(new FieldColour("#ffffff"), "COLOR")
          .appendField("for")
          .appendField(new Blockly.FieldNumber(10, 1), "DURATION")
          .appendField("frames");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip("Flashes the entire screen a color.");
    }
  };

  // Create Particles Block
  Blockly.Blocks['create_particles'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Create Particles ✨")
          .appendField("at x:")
          .appendField(new Blockly.FieldNumber(200), "X")
          .appendField("y:")
          .appendField(new Blockly.FieldNumber(200), "Y");
      this.appendDummyInput()
          .appendField("Color:")
          .appendField(new FieldColour("#3b82f6"), "COLOR")
          .appendField("Count:")
          .appendField(new Blockly.FieldNumber(10, 1, 50), "COUNT");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip("Creates a burst of particles!");
    }
  };

  // Coffee Block
  Blockly.Blocks['coffee'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Energize with Coffee ☕")
          .appendField("Sprite:")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip("Gives a sprite a caffeine boost! (Faster & Pulsing)");
    }
  };

  // Sound Block (Visual Cue)
  Blockly.Blocks['play_sound'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Play Sound 🔊")
          .appendField(new Blockly.FieldDropdown([
            ["Pop! 🎈", "POP"],
            ["Laser 🔫", "LASER"],
            ["Jump 🦘", "JUMP"],
            ["Coin 🪙", "COIN"],
            ["Explosion 💥", "EXPLOSION"]
          ]), "SOUND");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip("Plays a sound effect!");
    }
  };

  // ── PRINT BLOCK — the "Hello World" moment ───────────────────────────────
  // Zero config: just type text, drag to canvas area. Shows centered, always.
  // Works standalone OR inside any event. The first spark for beginners.
  Blockly.Blocks['print_text'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("📺 Print")
          .appendField(new Blockly.FieldTextInput("Hello World!"), "TEXT");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(65); // warm yellow-green — stands out
      this.setTooltip("Prints text on the canvas! Works anywhere — no setup needed.");
    }
  };

  // Text Block
  Blockly.Blocks['display_text'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Display Text 💬");
      this.appendDummyInput()
          .appendField("Text:")
          .appendField(new Blockly.FieldTextInput("Hello!"), "TEXT");
      this.appendDummyInput()
          .appendField("at x:")
          .appendField(new Blockly.FieldNumber(200), "X")
          .appendField("y:")
          .appendField(new Blockly.FieldNumber(50), "Y");
      this.appendDummyInput()
          .appendField("Size:")
          .appendField(new Blockly.FieldNumber(24, 8, 100), "SIZE")
          .appendField("Color:")
          .appendField(new Blockly.FieldDropdown([
            ["White", "#ffffff"],
            ["Yellow", "#eab308"],
            ["Red", "#ef4444"],
            ["Green", "#22c55e"],
            ["Blue", "#3b82f6"],
            ["Purple", "#a855f7"]
          ]), "COLOR");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(20);
      this.setTooltip("Displays text on the screen.");
    }
  };

  // Camera: Follow
  Blockly.Blocks['camera_follow'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Camera: Follow Sprite 🎥")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(200);
      this.setTooltip("Makes the camera follow a specific sprite by its ID.");
    }
  };

  // Control: Wait
  Blockly.Blocks['wait_seconds'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Wait ⏳")
          .appendField(new Blockly.FieldNumber(1, 0, 10), "SECONDS")
          .appendField("seconds");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(120);
      this.setTooltip("Pauses execution for a bit.");
    }
  };

  // Math: Constants (PI, E, etc.)
  Blockly.Blocks['math_constant_custom'] = {
    init: function() {
      this.appendDummyInput()
          .appendField(new Blockly.FieldDropdown([
            ["π", "PI"],
            ["e", "E"],
            ["φ", "GOLDEN_RATIO"],
            ["sqrt(2)", "SQRT2"],
            ["sqrt(0.5)", "SQRT1_2"],
            ["∞", "INFINITY"]
          ]), "CONSTANT");
      this.setOutput(true, "Number");
      this.setColour(230);
      this.setTooltip("Returns one of the common mathematical constants.");
    }
  };

  // Sprite: Get Property
  Blockly.Blocks['get_sprite_property'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Sprite")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID")
          .appendField("'s")
          .appendField(new Blockly.FieldDropdown([
            ["X Position", "X"],
            ["Y Position", "Y"],
            ["X Velocity", "VX"],
            ["Y Velocity", "VY"],
            ["Rotation", "ROTATION"],
            ["Size", "SIZE"],
            ["Opacity", "OPACITY"]
          ]), "PROPERTY");
      this.setOutput(true, "Number");
      this.setColour(260);
      this.setTooltip("Returns a property of a specific sprite.");
    }
  };

  // Sprite: Set Property
  Blockly.Blocks['set_sprite_property'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Set Sprite")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID")
          .appendField("'s")
          .appendField(new Blockly.FieldDropdown([
            ["X Position", "X"],
            ["Y Position", "Y"],
            ["X Velocity", "VX"],
            ["Y Velocity", "VY"],
            ["Rotation", "ROTATION"],
            ["Size", "SIZE"],
            ["Opacity", "OPACITY"]
          ]), "PROPERTY")
          .appendField("to");
      this.appendValueInput("VALUE")
          .setCheck("Number");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip("Sets a property of a specific sprite.");
    }
  };

  // Timeline: When Frame
  Blockly.Blocks['on_frame'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("When frame is")
          .appendField(new Blockly.FieldNumber(0, 0), "FRAME");
      this.appendStatementInput("DO")
          .setCheck(null)
          .appendField("do");
      this.setColour(290);
      this.setTooltip("Triggers a sequence of blocks at a specific frame.");
    }
  };

  // Timeline: Tween
  Blockly.Blocks['tween_sprite'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Smoothly Change")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID")
          .appendField("'s")
          .appendField(new Blockly.FieldDropdown([
            ["X Position", "X"],
            ["Y Position", "Y"],
            ["Rotation", "ROTATION"],
            ["Size", "SIZE"],
            ["Opacity", "OPACITY"]
          ]), "PROPERTY")
          .appendField("to");
      this.appendValueInput("VALUE")
          .setCheck("Number");
      this.appendDummyInput()
          .appendField("over")
          .appendField(new Blockly.FieldNumber(60, 1), "DURATION")
          .appendField("frames")
          .appendField("using")
          .appendField(new Blockly.FieldDropdown([
            ["Linear", "LINEAR"],
            ["Ease In", "EASE_IN"],
            ["Ease Out", "EASE_OUT"],
            ["Ease In-Out", "EASE_IN_OUT"]
          ]), "EASING");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip("Smoothly animates a sprite property over time.");
    }
  };

  // Timeline: Current Frame
  Blockly.Blocks['current_frame'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Current Frame");
      this.setOutput(true, "Number");
      this.setColour(290);
      this.setTooltip("Returns the current frame count of the game.");
    }
  };

  // Timeline: Shake Sprite
  Blockly.Blocks['shake_sprite_for'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Shake Sprite")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID")
          .appendField("for")
          .appendField(new Blockly.FieldNumber(30, 1), "DURATION")
          .appendField("frames");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip("Makes a sprite jitter for a set amount of time.");
    }
  };

  // Data: Sprite ID
  Blockly.Blocks['sprite_id'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("My Sprite ID");
      this.setOutput(true, "Number");
      this.setColour(160);
      this.setTooltip("Returns the unique ID of the sprite running this block.");
    }
  };

  // Data: Set Database Value
  Blockly.Blocks['db_set'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("DB: Set")
          .appendField(new Blockly.FieldTextInput("score"), "KEY")
          .appendField("to");
      this.appendValueInput("VALUE")
          .setCheck(null);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip("Saves a value to the persistent database.");
    }
  };

  // Data: Get Database Value
  Blockly.Blocks['db_get'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("DB: Get")
          .appendField(new Blockly.FieldTextInput("score"), "KEY");
      this.setOutput(true, null);
      this.setColour(160);
      this.setTooltip("Retrieves a value from the persistent database.");
    }
  };

  // Data: Set Local Variable
  Blockly.Blocks['set_variable'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Set variable")
          .appendField(new Blockly.FieldTextInput("x"), "VAR")
          .appendField("to");
      this.appendValueInput("VALUE")
          .setCheck(null);
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip("Sets a local variable for this sprite.");
    }
  };

  // Data: Get Local Variable
  Blockly.Blocks['get_variable'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("variable")
          .appendField(new Blockly.FieldTextInput("x"), "VAR");
      this.setOutput(true, null);
      this.setColour(160);
      this.setTooltip("Gets the value of a local variable.");
    }
  };

  // Data: Change Local Variable
  Blockly.Blocks['change_variable'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Change variable")
          .appendField(new Blockly.FieldTextInput("x"), "VAR")
          .appendField("by");
      this.appendValueInput("VALUE")
          .setCheck("Number");
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(160);
      this.setTooltip("Changes a local variable by a specific amount.");
    }
  };

  // Group: Add to Group
  Blockly.Blocks['add_to_group'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Add Sprite")
          .appendField(new Blockly.FieldNumber(0, 0, 99), "SPRITE_ID")
          .appendField("to Group")
          .appendField(new Blockly.FieldTextInput("group1"), "GROUP_NAME");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip("Adds a sprite to a named group for collective manipulation.");
    }
  };

  // Group: Move Group
  Blockly.Blocks['move_group'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Move Group")
          .appendField(new Blockly.FieldTextInput("group1"), "GROUP_NAME")
          .appendField(new Blockly.FieldDropdown([["Forward","FORWARD"], ["Backward","BACKWARD"]]), "DIRECTION")
          .appendField("by");
      this.appendValueInput("STEPS")
          .setCheck("Number");
      this.appendDummyInput()
          .appendField("steps");
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip("Moves all sprites in the group together.");
    }
  };

  // Group: Rotate Group
  Blockly.Blocks['rotate_group'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Rotate Group")
          .appendField(new Blockly.FieldTextInput("group1"), "GROUP_NAME")
          .appendField("by");
      this.appendValueInput("ANGLE")
          .setCheck("Number");
      this.appendDummyInput()
          .appendField("degrees");
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(330);
      this.setTooltip("Rotates all sprites in the group around their own centers.");
    }
  };

  // Event: When Key Pressed
  Blockly.Blocks['on_key_pressed'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("When")
          .appendField(new Blockly.FieldDropdown([
            ["Space", " "],
            ["Up Arrow", "ArrowUp"],
            ["Down Arrow", "ArrowDown"],
            ["Left Arrow", "ArrowLeft"],
            ["Right Arrow", "ArrowRight"],
            ["W", "w"],
            ["A", "a"],
            ["S", "s"],
            ["D", "d"]
          ]), "KEY")
          .appendField("Key Pressed ⌨️");
      this.appendStatementInput("STACK")
          .setCheck(null);
      this.setColour(120);
      this.setTooltip("Runs these blocks when a key is pressed.");
    }
  };

  // Event: When Game Starts
  Blockly.Blocks['on_start'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("When Game Starts 🚀");
      this.appendStatementInput("STACK")
          .setCheck(null);
      this.setColour(120);
      this.setTooltip("Runs these blocks when the game begins.");
    }
  };

  // Event: Every Frame
  Blockly.Blocks['on_tick'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Every Frame 🔄");
      this.appendStatementInput("STACK")
          .setCheck(null);
      this.setColour(160);
      this.setTooltip("Runs these blocks 60 times every second.");
    }
  };

  // Event: When Sprites Collide
  Blockly.Blocks['on_collision'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("When Sprites Collide 💥");
      this.appendStatementInput("STACK")
          .setCheck(null);
      this.setColour(0);
      this.setTooltip("Runs these blocks when two sprites hit each other.");
    }
  };

  // Physics: Bounce
  Blockly.Blocks['bounce_on_edge'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Bounce if on edge 🏀");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip("Makes the sprite bounce back if it hits the wall.");
    }
  };

  // Physics: Gravity
  Blockly.Blocks['set_gravity'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Set Gravity to")
          .appendField(new Blockly.FieldNumber(0.5, 0, 2), "GRAVITY");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip("Sets the downward pull on all sprites.");
    }
  };

  // Physics: Friction
  Blockly.Blocks['set_friction'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Set Friction to")
          .appendField(new Blockly.FieldNumber(0.1, 0, 1), "FRICTION");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(290);
      this.setTooltip("Sets how much sprites slow down over time.");
    }
  };

  // Sensor: Key Pressed
  Blockly.Blocks['is_key_pressed'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Key")
          .appendField(new Blockly.FieldDropdown([
            ["Space", " "],
            ["Up Arrow", "ArrowUp"],
            ["Down Arrow", "ArrowDown"],
            ["Left Arrow", "ArrowLeft"],
            ["Right Arrow", "ArrowRight"],
            ["W", "w"],
            ["A", "a"],
            ["S", "s"],
            ["D", "d"]
          ]), "KEY")
          .appendField("is pressed? ⌨️");
      this.setOutput(true, "Boolean");
      this.setColour(210);
      this.setTooltip("Returns true if the key is currently held down.");
    }
  };

  // Sprite: Create
  Blockly.Blocks['create_sprite'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Create Sprite 👾");
      this.appendDummyInput()
          .appendField("at x:")
          .appendField(new Blockly.FieldNumber(200), "X")
          .appendField("y:")
          .appendField(new Blockly.FieldNumber(200), "Y");
      this.appendDummyInput()
          .appendField("size:")
          .appendField(new Blockly.FieldNumber(40), "SIZE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip("Creates a new sprite at a specific position.");
    }
  };

  // World: Create Block
  Blockly.Blocks['create_block'] = {
    init: function() {
      this.appendDummyInput()
          .appendField("Create Block 🧱");
      this.appendDummyInput()
          .appendField("at x:")
          .appendField(new Blockly.FieldNumber(200), "X")
          .appendField("y:")
          .appendField(new Blockly.FieldNumber(200), "Y");
      this.appendDummyInput()
          .appendField("size:")
          .appendField(new Blockly.FieldNumber(40), "SIZE");
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setColour(260);
      this.setTooltip("Creates a static block that sprites can bounce off of.");
    }
  };
}

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Events 🚀',
      colour: '120',
      contents: [
        { kind: 'block', type: 'on_start' },
        { kind: 'block', type: 'on_tick' },
        { kind: 'block', type: 'on_key_pressed' },
        { kind: 'block', type: 'on_collision' }
      ]
    },
    {
      kind: 'category',
      name: 'Movement 🏃',
      colour: '230',
      contents: [
        {
          kind: 'category',
          name: 'Motion',
          colour: '230',
          contents: [
            { kind: 'block', type: 'move_sprite' },
            { kind: 'block', type: 'rotate_sprite' },
            { kind: 'block', type: 'flip_sprite' }
          ]
        },
        {
          kind: 'category',
          name: 'Physics',
          colour: '290',
          contents: [
            { kind: 'block', type: 'bounce_on_edge' },
            { kind: 'block', type: 'set_gravity' },
            { kind: 'block', type: 'set_friction' },
            { kind: 'block', type: 'shake_sprite_for' }
          ]
        }
      ]
    },
    {
      kind: 'category',
      name: 'Visuals ✨',
      colour: '20',
      contents: [
        {
          kind: 'category',
          name: 'Looks',
          colour: '20',
          contents: [
            { kind: 'block', type: 'print_text' },
            { kind: 'block', type: 'change_appearance' },
            { kind: 'block', type: 'display_text' },
            { kind: 'block', type: 'play_sound' },
            { kind: 'block', type: 'flash_screen' },
            { kind: 'block', type: 'create_particles' },
            { kind: 'block', type: 'coffee' }
          ]
        },
        {
          kind: 'category',
          name: 'Camera',
          colour: '200',
          contents: [
            { kind: 'block', type: 'camera_follow' }
          ]
        }
      ]
    },
    {
      kind: 'category',
      name: 'Logic & Control 🧠',
      colour: '210',
      contents: [
        {
          kind: 'category',
          name: 'Logic',
          colour: '210',
          contents: [
            { kind: 'block', type: 'controls_if' },
            { kind: 'block', type: 'logic_compare' },
            { kind: 'block', type: 'logic_operation' },
            { kind: 'block', type: 'logic_boolean' },
            { kind: 'block', type: 'is_key_pressed' }
          ]
        },
        {
          kind: 'category',
          name: 'Control',
          colour: '120',
          contents: [
            { kind: 'block', type: 'wait_seconds' },
            { kind: 'block', type: 'controls_repeat_ext' },
            { kind: 'block', type: 'on_frame' },
            { kind: 'block', type: 'current_frame' }
          ]
        },
        {
          kind: 'category',
          name: 'Math',
          colour: '230',
          contents: [
            { kind: 'block', type: 'math_number' },
            { kind: 'block', type: 'math_arithmetic' },
            { kind: 'block', type: 'math_single' },
            { kind: 'block', type: 'math_trig' },
            { kind: 'block', type: 'math_constant_custom' },
            { kind: 'block', type: 'math_round' },
            { kind: 'block', type: 'math_modulo' },
            { kind: 'block', type: 'math_random_int', 
              inputs: {
                FROM: { shadow: { type: 'math_number', fields: { NUM: 1 } } },
                TO: { shadow: { type: 'math_number', fields: { NUM: 100 } } }
              }
            }
          ]
        }
      ]
    },
    {
      kind: 'category',
      name: 'Data & Variables 📊',
      colour: '160',
      contents: [
        {
          kind: 'category',
          name: 'Local Data',
          colour: '160',
          contents: [
            { kind: 'block', type: 'sprite_id' },
            { kind: 'block', type: 'set_variable' },
            { kind: 'block', type: 'get_variable' },
            { kind: 'block', type: 'change_variable' }
          ]
        },
        {
          kind: 'category',
          name: 'Global DB',
          colour: '160',
          contents: [
            { kind: 'block', type: 'db_set' },
            { kind: 'block', type: 'db_get' }
          ]
        },
        {
          kind: 'category',
          name: 'Variables',
          custom: 'VARIABLE',
          colour: '330'
        },
        {
          kind: 'category',
          name: 'Groups',
          colour: '330',
          contents: [
            { kind: 'block', type: 'add_to_group' },
            { kind: 'block', type: 'move_group' },
            { kind: 'block', type: 'rotate_group' }
          ]
        }
      ]
    },
    {
      kind: 'category',
      name: 'Sprites 👾',
      colour: '260',
      contents: [
        { kind: 'block', type: 'create_sprite' },
        { kind: 'block', type: 'create_block' },
        { kind: 'block', type: 'get_sprite_property' },
        { kind: 'block', type: 'set_sprite_property' },
        { kind: 'block', type: 'tween_sprite' }
      ]
    }
  ]
};

