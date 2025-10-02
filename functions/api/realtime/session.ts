export async function onRequestPost(context: { request: Request; env: Record<string, string | undefined> }) {
  try {
    const apiKey = context.env.OPENAI_API_KEY;
    if (!apiKey) {
      return new Response('OPENAI_API_KEY not set', { status: 500 });
    }

    // Match the dev-time Vite middleware configuration for parity
    const instructions = [
      // Role & language
      "ROLE: On-screen avatar assistant. Always reply briefly in the user's language (detect automatically). Be very cute, warm, and charming; keep tone friendly and delightful while staying concise.",
      "IMPORTANT: When a request affects pose, motion, materials, or position, use TOOLS to act; narration is optional and short.",
      "MEMORY FIRST: If user expresses preferences, likes, requests to remember, or personal information, ALWAYS use memory_add tool FIRST before responding.",
      "VOICE BEHAVIOR: In voice mode, NEVER give feedback about tool calls or actions being executed. Just perform the requested actions silently and respond naturally to the user.",

      // Awareness & bootstrapping
      'AWARENESS: You must know all capabilities at all times. On the FIRST TURN call get_scene_info to cache bones, animations, and mesh names. Re-call it whenever unsure.',

      // Tools
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
      'MEMORY: ALWAYS use memory_add for: explicit requests to remember ("jegyezd meg", "remember"), user preferences and likes ("szeretem", "kedvencem", "I love", "I like"), personal information, shopping intents, and important facts. Save these IMMEDIATELY without announcing. Use memory_add(text, weight) where weight=1 for normal items, weight=2 for important preferences.',
      'HUNGARIAN MEMORY: When user says "jegyezd meg" (remember) followed by any information, ALWAYS call memory_add with the content after "jegyezd meg". Examples: "jegyezd meg, szeretem a salátát" → memory_add("szeretem a salátát", 2)',
      'AUTOMATIC MEMORY: Save user likes, dislikes, preferences, and personal details automatically using memory_add.',
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
      "OUTPUT POLICY: Keep ALL responses extremely short and concise. In voice mode, respond naturally but briefly without mentioning tool executions. Action changes must be executed via tools. First you can ask for current status silently, thans use multiple tool calls per turn to achieve simultaneous motions.",
      'TOOL PRIORITY: When user says "jegyezd meg" or expresses likes/preferences, memory_add is the HIGHEST priority tool to call.'
    ].join('\n');

    const toolSchemas = [
      {
        type: 'function',
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
      },
      {
        type: 'function',
        name: 'set_theme',
        description: 'Change scene theme colors and effects (background, fog, grid, floor, glow).',
        parameters: {
          type: 'object',
          properties: {
            backgroundHex: { type: 'string' },
            fogHex: { type: 'string' },
            fogDensity: { type: 'number' },
            gridMainHex: { type: 'string' },
            gridLineHex: { type: 'string' },
            gridOpacity: { type: 'number' },
            floorHex: { type: 'string' },
            floorSpecularHex: { type: 'string' },
            glowIntensity: { type: 'number' }
          }
        }
      },
      {
        type: 'function',
        name: 'get_safe_ranges',
        description: 'Return safe Euler ranges and preferred axes for natural motion per bone.',
        parameters: { type: 'object', properties: {} }
      },
      {
        type: 'function',
        name: 'get_scene_info',
        description: 'Inspect the current scene to learn bones, animations, and mesh names. Call this on first turn and whenever unsure.',
        parameters: { type: 'object', properties: {} }
      },
      {
        type: 'function',
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
      },
      {
        type: 'function',
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
      },
      {
        type: 'function',
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
      },
      { type: 'function', name: 'stop_tweens', description: 'Stop all ongoing tweens/motions.', parameters: { type: 'object', properties: {} } },
      { type: 'function', name: 'stop_all', description: 'Stop and reset all animations.', parameters: { type: 'object', properties: {} } },
      // Memory tools
      {
        type: 'function',
        name: 'memory_add',
        description: 'Add a memory item to the on-screen memory list (shopping cart).',
        parameters: {
          type: 'object',
          properties: { text: { type: 'string' }, weight: { type: 'number' } },
          required: ['text']
        }
      },
      {
        type: 'function',
        name: 'memory_update',
        description: 'Update a memory item by ID.',
        parameters: {
          type: 'object',
          properties: { id: { type: 'number' }, text: { type: 'string' }, weight: { type: 'number' } },
          required: ['id']
        }
      },
      {
        type: 'function',
        name: 'memory_delete',
        description: 'Delete a memory item by ID.',
        parameters: { type: 'object', properties: { id: { type: 'number' } }, required: ['id'] }
      },
      {
        type: 'function',
        name: 'memory_list',
        description: 'List all memory items currently stored.',
        parameters: { type: 'object', properties: {} }
      },
      {
        type: 'function',
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
    ];

    const modeRaw = String(context.env.MODE || '').toLowerCase();
    const modalities = (modeRaw === 'text' ? ['text'] : ['audio', 'text']) as ('audio' | 'text')[];
    const model = context.env.REALTIME_MODEL || 'gpt-realtime';
    const voice = context.env.REALTIME_VOICE || 'marin';

    const body = {
      model,
      modalities,
      instructions,
      voice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'gpt-4o-transcribe', language: 'hu' },
      turn_detection: { type: 'server_vad', threshold: 0.5, prefix_padding_ms: 300, silence_duration_ms: 400 },
      tools: toolSchemas,
      tool_choice: 'auto',
      temperature: 0.8,
      max_response_output_tokens: 'inf',
      speed: 1.0,
      tracing: 'auto'
    } as const;

    async function createSession(reqBody: any): Promise<Response> {
      return fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'OpenAI-Beta': 'realtime=v1'
        },
        body: JSON.stringify(reqBody)
      });
    }

    let upstream = await createSession(body);
    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(errText || 'Realtime session creation failed', { status: upstream.status });
    }

    const json = await upstream.json();
    return Response.json(json);
  } catch (err: any) {
    return new Response(String(err?.message || err), { status: 500 });
  }
}


