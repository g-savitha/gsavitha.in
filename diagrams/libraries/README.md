# Excalidraw libraries

Public Excalidraw libraries for blog diagrams. Each file is an unmodified download from
[libraries.excalidraw.com](https://libraries.excalidraw.com), which publishes them from the
[excalidraw/excalidraw-libraries](https://github.com/excalidraw/excalidraw-libraries) repo under its
MIT licence. Load one into any Excalidraw editor with the library menu's "Open" button.

## Icons

Use these only where the icon adds meaning: people, databases and caches, queues and Kafka, AI or
cloud services. Plain steps and labels get no icon.

| File                          | Library                  | Author                                                | Has                                                            |
| ----------------------------- | ------------------------ | ----------------------------------------------------- | -------------------------------------------------------------- |
| `it-icons.excalidrawlib`      | IT icons                 | [Mateusz Baran](https://github.com/mateuszbaransanok) | user, server, database, cloud, model (LLM), document, and more |
| `system-design.excalidrawlib` | System Design Components | [Rohan Pithadiya](https://github.com/Rohanpithadiya)  | cache, message queue, load balancer, CDN                       |
| `data-sources.excalidrawlib`  | Data sources             | [Kishore](https://github.com/kvchitrapu)              | Kafka                                                          |
| `robots.excalidrawlib`        | Robots                   | [Kaligule](https://schauderbasis.de)                  | agent / bot                                                    |

## Low-level design

| File                             | Library                        | Author                                                         | Has                                                                                  |
| -------------------------------- | ------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `uml-er.excalidrawlib`           | Shapes for UML & ER Diagrams   | [BjoernKW](https://github.com/BjoernKW)                        | UML class boxes, ER entities and relationship lines                                  |
| `uml-activity.excalidrawlib`     | UML Library: Activity Diagram  | [Krzysztof Koper](https://www.linkedin.com/in/krzysztofkoper/) | initial/final states, actions, decisions, fork/join, swimlanes, comment (note) boxes |
| `flowchart.excalidrawlib`        | Flow Chart Symbols             | [Fin](https://www.facebook.com/thingsaboutwebdev/)             | start/end, process, decision, document, database, input/output, connectors           |
| `data-structures.excalidrawlib`  | Algorithms and Data Structures | [intradeus](https://github.com/intradeus)                      | arrays, matrices, hash table, linked lists, trees, red-black nodes, rotations        |
| `graphs.excalidrawlib`           | Graphs                         | [Jakub Pawlina](https://jakubpawlina.me)                       | common graph shapes (nodes and edges)                                                |
| `network-topology.excalidrawlib` | Network topology icons         | [dwelle](https://github.com/dwelle)                            | client, server, router, switch, hub, firewall, VPN                                   |
| `message-queue.excalidrawlib`    | Message Queue components       | [Andrew Ruan](https://github.com/coexist)                      | message, channel, topic, queue, subscriber, queue manager                            |

No public library has sequence-diagram parts, so draw those by hand: header boxes, dashed
lifelines, arrows. The note boxes in the sequence diagrams use the dog-eared comment shape from
`uml-activity.excalidrawlib`.

In diagrams, recolour library shapes to the node's stroke colour so they read on the dark
background, and drop their built-in text labels in favour of the node's own label.
