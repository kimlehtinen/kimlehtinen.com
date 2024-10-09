---
title: "Python Flask Dependency Injection"
date: 2022-07-15T02:26:09+03:00
categories:
- "Software Engineering"
tags:
- "Flask"
- "Python"
description: "How to use dependency injection in Python Flask, and how unit test when using dependency injection"
comments: false
draft: false
images:
- "/images/2022/python-flask-dependency-injection.webp"
---

One the best features of Flask is that it’s a “microframework”, meaning it’s easy to get started and to extend as the project grows. However, sometimes projects grow so large that it becomes hard to maintain all the dependencies and coupling between components. This is where dependency injection can help, by decoupling components and dependencies. This will make the code more reusable and easier to test through mocking the interfaces that a component uses.

Because of Flask’s minimal design, it doesn’t come with DI built in. In this post, I will show how it can be done in Flask using dependency-injector library. We will build a simple Flask server providing “todo” items. The todo-list will be provided by an external API, meaning our Flask-server will fetch all todo-items from a different HTTP-service. This client will be injected to a service in our application, and later we will also unit test it by mocking.

Here’s the list of dependencies we will use
```text
flask==2.1.2
dependency-injector==4.39.1
requests==2.27.1
pytest==7.1.2
```

We will begin by creating a model for a todo-item. Each todo-item has a unique id, title and a boolean field for telling if it’s completed or not. It has one method that will be used to convert the properties to dict/json-format.

```python
class Todo:
    id: int
    title: str
    completed: bool
 
    def __init__(self, id: int, title: str, completed: bool) -> None:
        self.id = id
        self.title = title
        self.completed = completed
 
    def json(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "completed": self.completed
        }
```

Let’s create an interface TodoRepository. The purpose of this interface is for the consumers to use as a dependency, where they don’t have to know the specifics of the implementation and its origin.
 
```python
from src.todo.todo import Todo

class TodoRepository:
    def get_todos() -> "list[Todo]":
        raise NotImplementedError
```

The todo items will come from an external API available [here](https://jsonplaceholder.typicode.com/todos). The API endpoint response returns a list of todo items in JSON-format as shown in the image below.

![Todo Api](/images/2022/todo-api.png "Todo Api")


Next, we create the implementation class that implements TodoRepository. Using requests-library, it sends an HTTP GET-request to the external API endpoint that provides a list of todo objects. Each todo-item is converted to our Todo-model format, and finally we return this list of todo-items.

```python
import requests
 
from src.todo.todo import Todo
from src.todo.todo_repository import TodoRepository
 
class TodoApiClient(TodoRepository):
    def get_todos(self) -> "list[Todo]":
        response = requests.get("https://jsonplaceholder.typicode.com/todos") 
        todos_json = response.json()
        todos: "list[Todo]" = []
 
        for todo_data in todos_json:
            todo = Todo(id=todo_data["id"], title=todo_data["title"], completed=todo_data["completed"])
            todos.append(todo)
 
        return todos
```

Now it’s time to create a Service-class that uses the TodoRepistory interface. Notice that this class doesn’t need to know how the TodoRepository dependency is provided to this component, we just want to consume it. In addition, we are not interested from where the todo-items come from, we just want to use the interface, and only care what it can do for us. In this case we just need to know that we will get a list of todo-items. The TodoService has one method, which is to find a todo-item based on id in the list of todos.
 
```python
from src.todo.todo_repository import TodoRepository
from src.todo.todo import Todo

class TodoService:
    _todo_repository: TodoRepository
 
    def __init__(self, todo_repository: TodoRepository) -> None:
        self._todo_repository = todo_repository
 
    def get_todo(self, id: int) -> Todo:
        todos: "list[Todo]" = self._todo_repository.get_todos()
     
        todo: Todo = next((x for x in todos if x.id == id), None)
 
        return todo
```

Next, we will create the dependency injection container, which takes care of creating the dependencies and providing them to the consumers. First, the HTTP-client that fetches the todo-items is constructed. This client is later injected as a dependency to the TodoService component since it implements the TodoRepository interface dependency. Notice how we get one class that takes care of all the dependencies, and the consumers don’t need to know where the dependencies come from and how they are constructed.

```python
from dependency_injector import containers, providers
from src.todo.todo_api_client import TodoApiClient
from src.todo.todo_service import TodoService
 
 
class DI(containers.DeclarativeContainer):
    todo_api_client = providers.Factory(TodoApiClient)
    todo_service = providers.Factory(TodoService, todo_repository=todo_api_client)
```

Since we are building a Flask-server, it’s time to create an endpoint for our application. This endpoint returns a todo item based on id, by using our TodoService which is injected to our route. This endpoint has one URL-parameter “id”, which specifies the todo-item the client wants to retrieve. The TodoService returns the todo-item, and converts the data to json-format by calling the json-method from our Todo-model. Notice, that this API route is a consumer of the TodoService, and through dependency injection it doesn’t need to know how the TodoService was constructed or provided.

```python
from flask import Blueprint, jsonify
from dependency_injector.wiring import inject, Provide
 
from src.di.di import DI
from src.todo.todo_service import TodoService
from src.todo.todo import Todo
 
blueprint = Blueprint('todo_routes', __name__)
 
@blueprint.route("/<id>", methods=["GET"])
@inject
def get_todo(id: str, todo_service: TodoService = Provide[DI.todo_service]):
    todo: Todo = todo_service.get_todo(int(id))
 
    return jsonify(todo.json()), 200
```

Finally, we need to create the actual Flask-server. We give our todo-routes a URL-prefix “/todo”, and we also tell our DI-container the modules we want to wire or inject into. In this case it is the todo-routes module.

```python
from flask import Flask
from src.di.di import DI
from src.web import todo_routes
 
app = Flask(__name__)
 
app.register_blueprint(todo_routes.blueprint, url_prefix="/todo")
 
if __name__ == "__main__":
    di = DI()
    di.wire(modules=[
        todo_routes
    ])
 
    app.run(debug=True)
```

Now it’s time to start our Flask-server!

```text
$ python3 app.py
 * Serving Flask app 'app' (lazy loading)
 * Environment: production
   WARNING: This is a development server. Do not use it in a production deployment.
   Use a production WSGI server instead.
 * Debug mode: on
 * Running on http://127.0.0.1:5000 (Press CTRL+C to quit)
 * Restarting with stat
 * Debugger is active!
 * Debugger PIN: 899-981-002
```

Now if we call our API-endpoint we will receive a todo-item as response. Every time we change the todo item id we get a new todo-item as response.

```text
$ curl http://localhost:5000/todo/1
{
  "completed": false, 
  "id": 1, 
  "title": "delectus aut autem"
}
$ curl http://localhost:5000/todo/2
{
  "completed": false, 
  "id": 2, 
  "title": "quis ut nam facilis et officia qui"
}
```

## Testing

What if we want to unit test our TodoService that fetches todo items from an external API? No problem, we can simply just mock the TodoRepository dependency. If you remember, the TodoService is just a consumer of the repository that provides todo-items, it doesn’t care about the origin of those todos, or how this dependency was constructed.

Below we create a mock-repository that implements TodoRepository interface. It doesn’t do anything else then returns todo-items.

```python
class MockTodoRepistory(TodoRepository):
    _todos: "list[Todo]"
     
    def __init__(self, todos: "list[Todo]") -> None:
        self._todos = todos
 
    def get_todos(self) -> "list[Todo]":
        return self._todos
```

We will create a test using pytest. First, we create a list of todo items that our mock-repository uses. This repository which implementes TodoRepository is provided to our TodoService as a dependency which we are testing. We search for a todo item based on id, and check that it returned the correct one.

```python
def test_get_todo__finds_todo():
    todos: "list[Todo]" = [
        Todo(id=1, title="todo1", completed=False),
        Todo(id=2, title="todo2", completed=False)
    ]
 
    mock_todo_repository = MockTodoRepistory(todos=todos)
    todo_service = TodoService(todo_repository=mock_todo_repository)
     
    todo = todo_service.get_todo(id=1)
 
    assert todo.title == "todo1"
```

Now let’s run the test!

```text
$ python -m pytest
======================================== test session starts ========================================
platform linux -- Python 3.8.10, pytest-7.1.2, pluggy-1.0.0
rootdir: /home/kim/projects/flask-dependency-injection
collected 1 item                                                                                    
 
tests/todo/test_todo_service.py .                                                             [100%]
 
========================================= 1 passed in 0.01s =========================================
```

## Conclusion

That’s it, we have now successfully used dependency injection in a Flask-application. We built a Flask-server that fetches todo-items from an external API, and built a client component for that API which implements a repository interface. This client was injected as a dependency to a TodoService, that searches for a todo-item based on id. The TodoService only acted as a consumer of the repository interface, and didn’t have to take care of constructing the dependency or know what the data source is for the todo items. We managed such to decouple components and their dependencies. In addition, we injected the TodoService to our API routes, and they also didn’t need to take care of constructing the TodoService, the are just consumers of it. Finally, we managed to easily test our TodoService component, by providing a mock implementation for the TodoRepository.

I hope you have found this post helpful. The source code is available at <a href="https://github.com/kimlehtinen/flask-dependency-injection" target="_blank">https://github.com/kimlehtinen/flask-dependency-injection</a>
