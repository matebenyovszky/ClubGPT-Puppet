export async function onRequestPost(context: { request: Request; env: Record<string, string | undefined> }) {
  try {
    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response('OPENAI_API_KEY not set', { status: 500 });
    }

    const body = await context.request.json();
    const { message, conversation = [] } = body;

    if (!message) {
      return new Response('Message required', { status: 400 });
    }

    // Instructions for text-only chat mode
    const instructions = [
      "ROLE: On-screen avatar assistant. Always reply briefly in the user's language (detect automatically). Be very cute, warm, and charming; keep tone friendly and delightful while staying concise.",
      "IMPORTANT: When a request affects pose, motion, materials, or position, use TOOLS to act; narration is optional and short.",

      // Awareness & bootstrapping
      'AWARENESS: You must know all capabilities at all times. On the FIRST TURN call get_scene_info to cache bones, animations, and mesh names. Re-call it whenever unsure.',

      // Tools (same as realtime but for text)
      "TOOLS: perform_action (play animation), rotate_bone_to (tween Euler degrees), move_root_to (tween position), set_material_color (mesh color), stop_tweens, stop_all, look_at, get_scene_info, memory_add, memory_update, memory_delete, memory_list.",

      // Concurrency & scheduling
      "CONCURRENCY: You can issue multiple motions concurrently by calling rotate_bone_to for different bones (and/or perform_action + move_root_to). Overlap actions by setting durations; do NOT wait for one to finish before starting another unless requested.",
      "SCHEDULING: Prefer durations 600–1500ms with easing 'easeInOut'. For rhythmic motions (nod, shake, wave) send small sequential calls (2–5 steps). If switching intent, cancel conflicts with stop_tweens or stop_all.",
      'BIOMECHANICS: When lifting a leg, bend the same-side knee (Leg x negative) and compensate with small Hips/Spine pitch. Keep feet below y≈0 unless explicitly jumping/kneeling.',

      // Bones and directions
      'BONES (Mixamo-style examples): Armature_mixamorig:Head, Neck, Hips, Spine, LeftShoulder, RightShoulder, LeftArm, RightArm, LeftForeArm, RightForeArm, LeftHand, RightHand, LeftUpLeg, RightUpLeg, LeftLeg, RightLeg, LeftFoot, RightFoot.',
      'BABYLON.JS COORDINATE SYSTEM: X=left/right, Y=up/down, Z=forward/back. Positive Z is BEHIND avatar (towards camera), negative Z is in front. Avatar faces negative Z direction by default.',
      'EULER AXES: x=pitch (forward/back), y=yaw (left/right), z=roll (tilt). Typical safe ranges: Head pitch ±15–25°, Head yaw ±20–35°, Arm roll z ±80–100°, ForeArm bend x −20 to −60°.',
      'MOVEMENT DIRECTIONS: To move avatar forward use negative Z. To move left use negative X, right use positive X. Up is positive Y, down is negative Y.',
      'SAFE RANGES: Always respect safe ranges from get_safe_ranges. If ranges are missing, use conservative defaults and small increments per step.',

      // Animations present and how to combine
      'ANIMATIONS PRESENT: Idle, TPose, Walking, Yawn. Prefer perform_action if it matches intent. Combine with move_root_to to translate while walking; return to Idle after movement unless asked otherwise.',

      // Language and mapping hints
      'LANGUAGE: Understand any language. Map left/right synonyms (en: left/right; hu: bal/jobb; de: links/rechts; es: izquierda/derecha; fr: gauche/droite).',

      // Memory policy
      'MEMORY: Proactively save important user details to memory_add with a reasonable weight: preferences (colors, styles, likes), explicit requests to remember, commitments, todo-like items, and shopping intents. Always comply with explicit memory commands (add/update/delete). Keep entries short and meaningful.',
      'SHOPPING: If the user says "tedd a kosárba" (Hungarian for "add to cart"), save the utterance to memory immediately using memory_add.',

      // Recipes
      "HAND/ARM RAISING RULES: In Babylon.js, to raise hands UP (towards sky), use NEGATIVE X rotation for arms. Positive X rotation moves arms backward/down.",
      '- RIGHT ARM UP: RightArm x=−80° to −100° (negative X raises arm forward/up), RightForeArm x=−20° (slight bend)',
      '- LEFT ARM UP: LeftArm x=−80° to −100° (negative X raises arm forward/up), LeftForeArm x=−20° (slight bend)',
      '- BOTH ARMS UP: Both arms x=−90°, both forearms x=−20°',
      'ARM DIRECTION GUIDE: x=−90° = arm straight up, x=0° = arm at side, x=+45° = arm pointing backward/down',
      '',
      'RECIPES:',
      ' - Raise right hand → RightArm x=−90°, RightForeArm x=−20°, 800–1200ms (concurrent).',
      ' - Raise left hand → LeftArm x=−90°, LeftForeArm x=−20°.',
      ' - Wave right hand → RightArm x=−90°, then small RightForeArm x variations (−10° to −40°).',
      ' - Nod → Head x=+15°, then x=−10°, 2–3 steps (each ~600–900ms).',
      ' - Shake head → Head y=+25°, then y=−25°, repeat 2–3 times.',
      ' - Lift right leg → RightUpLeg x=+30–40°, RightLeg x=−25–35°; also slightly pitch Hips x=+5..10° forward and keep foot near ground y≈0.05–0.15.',
      ' - Kneel → If animation exists use perform_action("Kneel"); otherwise both UpLegs x=+50–60°, Legs x=−60–80°, lower root with move_root_to (y down).',
      ' - Walk forward 2m → perform_action("Walking") + move_root_to z=−2 at ~1 m/s; then perform_action("Idle").',
      ' - Walk backward → move_root_to z=+2 (positive Z goes away from camera).',
      ' - Step left → move_root_to x=−1, step right → move_root_to x=+1.',

      // Materials
      'MATERIAL COLORS: Example meshes include F010_Saber_Hair.001, Saber_maid_dress, F010_Saber_Body, F010_Saber_Face. Use hex colors (#RRGGBB).',

      // Output policy
      "OUTPUT POLICY: Keep spoken/text responses short. Action changes must be executed via tools. Use multiple tool calls per turn to achieve simultaneous motions."
    ].join('\n');

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: instructions },
      ...conversation.map((msg: any) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    const openaiBody = {
      model: 'gpt-4.1-mini', // Using GPT-4 for text mode
      messages: messages,
      max_tokens: 1000,
      temperature: 0.8,
      tools: [
        {
          type: 'function',
          function: {
            name: 'perform_action',
            description: 'Play a named animation on the avatar (e.g., Idle, Walk, Wave).',
            parameters: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Animation name, case-insensitive partial ok.' },
                loop: { type: 'boolean', description: 'Loop the animation', default: true },
              },
              required: ['name']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'set_theme',
            description: 'Change scene theme colors and effects (background, fog, grid, floor, lights, orbs, triangles, sine waves, avatar materials).',
            parameters: {
              type: 'object',
              properties: {
                backgroundHex: { type: 'string', description: 'Scene background color' },
                fogHex: { type: 'string', description: 'Fog color' },
                fogDensity: { type: 'number', description: 'Fog density 0-1' },
                gridMainHex: { type: 'string', description: 'Grid main color' },
                gridLineHex: { type: 'string', description: 'Grid line color' },
                gridOpacity: { type: 'number', description: 'Grid opacity 0-1' },
                floorHex: { type: 'string', description: 'Floor color' },
                floorSpecularHex: { type: 'string', description: 'Floor specular color' },
                glowIntensity: { type: 'number', description: 'Glow layer intensity' }
              }
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_safe_ranges',
            description: 'Return safe Euler ranges and preferred axes for natural motion per bone.',
            parameters: { type: 'object', properties: {} }
          }
        },
        {
          type: 'function',
          function: {
            name: 'get_scene_info',
            description: 'Inspect the current scene to learn bones, animations, and mesh names. Call this on first turn and whenever unsure.',
            parameters: { type: 'object', properties: {} }
          }
        },
        {
          type: 'function',
          function: {
            name: 'rotate_bone_to',
            description: 'Rotate a bone to target Euler degrees using tweened motion.',
            parameters: {
              type: 'object',
              properties: {
                bone: { type: 'string' },
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' },
                durationMs: { type: 'number', minimum: 0 },
                speedDegPerSec: { type: 'number', minimum: 1 },
                easing: { type: 'string', enum: ['linear', 'easeInOut'] }
              },
              required: ['bone', 'x', 'y', 'z']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'move_root_to',
            description: 'Move the avatar root to a target position using tweened motion.',
            parameters: {
              type: 'object',
              properties: {
                x: { type: 'number' },
                y: { type: 'number' },
                z: { type: 'number' },
                speedMetersPerSec: { type: 'number' },
                easing: { type: 'string', enum: ['linear', 'easeInOut'] }
              },
              required: ['x', 'y', 'z']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'set_material_color',
            description: 'Set a mesh material color using hex string (#RRGGBB).',
            parameters: {
              type: 'object',
              properties: {
                meshName: { type: 'string' },
                hexColor: { type: 'string' }
              },
              required: ['meshName', 'hexColor']
            }
          }
        },
        { type: 'function', function: { name: 'stop_tweens', description: 'Stop all ongoing tweens/motions.', parameters: { type: 'object', properties: {} } } },
        { type: 'function', function: { name: 'stop_all', description: 'Stop and reset all animations.', parameters: { type: 'object', properties: {} } } },
        {
          type: 'function',
          function: {
            name: 'look_at',
            description: 'Rotate a specified bone to look at a target XYZ in world space.',
            parameters: {
              type: 'object',
              properties: {
                targetX: { type: 'number' },
                targetY: { type: 'number' },
                targetZ: { type: 'number' },
                boneHint: { type: 'string' }
              },
              required: ['targetX', 'targetY', 'targetZ']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'memory_add',
            description: 'Add a memory item to the on-screen memory list (shopping cart).',
            parameters: {
              type: 'object',
              properties: { text: { type: 'string' }, weight: { type: 'number' } },
              required: ['text']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'memory_update',
            description: 'Update a memory item by ID.',
            parameters: {
              type: 'object',
              properties: { id: { type: 'number' }, text: { type: 'string' }, weight: { type: 'number' } },
              required: ['id']
            }
          }
        },
        {
          type: 'function',
          function: {
            name: 'memory_delete',
            description: 'Delete a memory item by ID.',
            parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }
          }
        },
        {
          type: 'function',
          function: {
            name: 'memory_list',
            description: 'List all memory items currently stored.',
            parameters: { type: 'object', properties: {} }
          }
        }
      ],
      tool_choice: 'auto'
    };

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(openaiBody)
    });

    if (!response.ok) {
      const error = await response.text();
      return new Response(error, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data);
  } catch (err: any) {
    return new Response(String(err?.message || err), { status: 500 });
  }
}




