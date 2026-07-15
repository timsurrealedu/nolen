# ML labelling policy

Labels are synthetic ground truth for experiments. They are stored in `simulations/labels.csv`, keyed by `event_id`; they must never be added to NEF events or sent by the agent.

## Event labels

The MVP uses `normal`, `brute_force`, `successful_compromise`, `privileged_activity`, `invalid_user_enumeration`, and `authorized_maintenance`.

## Window labels

The ML feature table has five-minute entity windows. A window is malicious if it contains an event labelled `brute_force`, `successful_compromise`, or `privileged_activity`. Otherwise, it is normal.

## Evaluation split

Split data by both scenario and time. No event from a scenario/date combination used for training may appear in test data. Random event-row splitting is prohibited because it leaks nearly identical attack traces between train and test data.
