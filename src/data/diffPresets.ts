export interface DiffPresetPair {
  id: string;
  title: string;
  description: string;
  beforeCode: string;
  afterCode: string;
}

export const DIFF_PRESET_PAIRS: DiffPresetPair[] = [
  {
    id: 'imu-frame-integration-fix',
    title: 'Fixed: body-frame vs world-frame integration',
    description: 'IMU integration minimal pair: pre- vs post-multiplying delta_q for body-frame angular rate',
    beforeCode: `import numpy as np

def integrate_imu_step(q_current, omega_b, dt):
    # omega_b: body-frame angular velocity [wx, wy, wz]
    # delta_q: incremental quaternion rotation computed from body angular rate
    delta_q = quat_from_angular_velocity(omega_b * dt)

    # BUG: Pre-multiplying q_current * delta_q applies delta_q as world-frame rotation
    # when omega_b is measured in body frame!
    q_next = q_current * delta_q
    return q_next`,
    afterCode: `import numpy as np

def integrate_imu_step(q_current, omega_b, dt):
    # omega_b: body-frame angular velocity [wx, wy, wz]
    # delta_q: incremental quaternion rotation computed from body angular rate
    delta_q = quat_from_angular_velocity(omega_b * dt)

    # FIX: delta_q is in body frame, so post-multiply delta_q * q_current
    q_next = delta_q * q_current
    return q_next`,
  },
  {
    id: 'quat-averaging-normalization-fix',
    title: 'Fixed: unnormalized quaternion averaging',
    description: 'Linear average of quaternions without renormalization vs normalized fix',
    beforeCode: `import numpy as np
from scipy.spatial.transform import Rotation as Rot

def compute_mean_orientation(q1, q2, q3):
    # q1, q2, q3 are unit quaternions [x, y, z, w]
    # BUG: Linear mean does not preserve unit norm |q| = 1
    q_avg = (q1 + q2 + q3) / 3.0

    # R_avg receives non-unit quaternion directly with no normalization step
    R_avg = Rot.from_quat(q_avg).as_matrix()
    return R_avg`,
    afterCode: `import numpy as np
from scipy.spatial.transform import Rotation as Rot

def compute_mean_orientation(q1, q2, q3):
    # q1, q2, q3 are unit quaternions [x, y, z, w]
    # FIX: Renormalize quaternion after linear averaging to preserve unit norm
    q_sum = q1 + q2 + q3
    q_avg = q_sum / np.linalg.norm(q_sum)

    R_avg = Rot.from_quat(q_avg).as_matrix()
    return R_avg`,
  },
];
