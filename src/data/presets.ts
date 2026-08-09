import { PresetExample } from '../types';

export const PRESET_EXAMPLES: PresetExample[] = [
  {
    id: 'clean-scipy-chain',
    title: 'Clean example',
    language: 'python',
    category: 'Clean Code',
    description: 'A correctly composed scipy Rotation chain (a→b, b→c, composed to a→c).',
    code: `from scipy.spatial.transform import Rotation as Rot

# R_a_b: maps frame b to frame a
R_a_b = Rot.from_quat([0.0, 0.0, 0.3826, 0.9238])  # scipy order: [x, y, z, w]

# R_b_c: maps frame c to frame b
R_b_c = Rot.from_quat([0.0, 0.7071, 0.0, 0.7071])

# Correct composition: (c -> b) then (b -> a) yields c -> a
R_a_c = R_a_b * R_b_c
`,
  },
  {
    id: 'buggy-composition',
    title: 'Composition order bug',
    language: 'python',
    category: 'Composition Order',
    description: 'Reversed R_body_cam / R_world_body composition order.',
    code: `import numpy as np

def compute_camera_to_world_rotation(R_world_body, R_body_cam):
    # R_world_body: maps body -> world coordinate frame
    # R_body_cam: maps cam -> body coordinate frame
    
    # BUG: Pre-multiplying R_body_cam @ R_world_body reverses composition order
    # The correct chain for cam -> world is R_world_body @ R_body_cam
    R_cam_point = R_body_cam @ R_world_body  # line 9: inverted matrix order
    
    return R_cam_point
`,
  },
  {
    id: 'ambiguous-quat-convention',
    title: 'Ambiguous quaternion convention',
    language: 'python',
    category: 'Convention Ambiguity',
    description: 'Hand-rolled quaternion class with no stated [w,x,y,z] vs [x,y,z,w] convention.',
    code: `import numpy as np

class Quaternion:
    def __init__(self, data):
        # Hand-rolled quaternion class without documented [w,x,y,z] or [x,y,z,w] order
        self.data = np.array(data)

    def to_rotation_matrix(self):
        # Unclear whether data[0] is scalar w or vector x
        q = self.data
        return np.array([
            [1 - 2*(q[1]**2 + q[2]**2), 2*(q[0]*q[1] - q[2]*q[3]), 2*(q[0]*q[2] + q[1]*q[3])],
            [2*(q[0]*q[1] + q[2]*q[3]), 1 - 2*(q[0]**2 + q[2]**2), 2*(q[1]*q[2] - q[0]*q[3])],
            [2*(q[0]*q[2] - q[1]*q[3]), 2*(q[1]*q[2] + q[0]*q[3]), 1 - 2*(q[0]**2 + q[1]**2)]
        ])

q_sensor = Quaternion([0.9238, 0.0, 0.0, 0.3826])
R_sensor = q_sensor.to_rotation_matrix()
`,
  },
  {
    id: 'unnormalized-quat',
    title: 'Un-normalized Quaternion after Linear Averaging',
    language: 'python',
    category: 'Normalization',
    description: 'Linear averaging of quaternions does not lie on S³; feeding directly into rotation matrix creates invalid scaling.',
    code: `import numpy as np
from scipy.spatial.transform import Rotation as Rot

def compute_mean_orientation(q1, q2, q3):
    # q1, q2, q3 are unit quaternions [x, y, z, w]
    # BUG: Linear mean does not preserve unit norm |q| = 1
    q_avg = (q1 + q2 + q3) / 3.0  # line 7: linear summation-based averaging
    
    # R_avg receives non-unit quaternion directly with no normalization step
    R_avg = Rot.from_quat(q_avg).as_matrix() # line 10
    return R_avg
`,
  },
  {
    id: 'scipy-eigen-quat',
    title: 'Quaternion Vector Indexing Mismatch (Scipy vs Eigen)',
    language: 'python',
    category: 'Convention Ambiguity',
    description: 'Eigen/ROS passes [w, x, y, z] order, but scipy.spatial.transform expects [x, y, z, w].',
    code: `import numpy as np
from scipy.spatial.transform import Rotation as Rot

def process_ros_imu_quaternion(q_ros):
    # q_ros received from ROS/Eigen C++ node formatted as [w, x, y, z]
    # q_ros = [0.9238, 0.0, 0.0, 0.3826] # w=0.9238, x=0, y=0, z=0.3826
    
    # BUG: Scipy's Rot.from_quat expects [x, y, z, w]
    # Passing [w, x, y, z] swaps scalar w with z coordinate!
    r = Rot.from_quat(q_ros)  # line 9: convention mismatch
    
    p_world = r.apply([1.0, 0.0, 0.0])
    return p_world
`,
  },
];

