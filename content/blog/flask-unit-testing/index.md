---
title: "Flask Unit Testing"
date: 2023-03-31T20:34:52+03:00
categories:
- "Software Engineering"
tags:
- "Flask"
- "Python"
- "Testing"
description: "Learn how to unit test Python Flask REST API applications using pytest, dependency injection and clean architecture."
comments: false
draft: false
images:
- "featured_image.webp"
---

For the longest time I haven't found good examples online on how to unit test [Flask](https://flask.palletsprojects.com) applications. Especially when following clean architecture, and when using dependency injection. That is why I decided to write this post. Flask is a minimalistic web framework, so I understand that most examples are small and simple. However, I know there are people out there building larger and more complex applications that requires good quality code, clean architecture and maintainability over time. Testing applications is an important aspect for achieving this.

The example application shown here is a REST API Flask application, using [dependency-injector](https://pypi.org/project/dependency-injector/) package for injecting services into API endpoints. For database ORM [SQLAlchemy](https://www.sqlalchemy.org/) is used. To make the database layer agnostic, [repository pattern](https://martinfowler.com/eaaCatalog/repository.html) is followed. In addition, [clean architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html) is used as inspiration in order to have a separation between web layer, business logic and infrastructure (databases, file system etc). Finally, [pytest](https://docs.pytest.org) is used as testing framework. Git repository can be found [here](https://github.com/kimlehtinen/blog-code/tree/main/flask-unit-testing).

## Table of Contents
- [Table of Contents](#table-of-contents)
- [Application setup](#application-setup)
- [Testing](#testing)
  - [Testing business logic](#testing-business-logic)
  - [Testing Flask API endpoints](#testing-flask-api-endpoints)
- [Conclusion](#conclusion)

## Application setup
Below is the application structure used. How to structure applications is subjective, this is just how I like to structure mine. The source code `src` is divided into different packages. Dependency injection code goes into `di`, anything interacting with external processes (database, files etc) goes into `infra`, API endpoints goes into `web`, and business logic packages under `modules`. In addition, test code is placed into `tests`, and follows a similar structure so that the code we are testing have corresponding test files. Notice that `pytest` test files have file name prefix `test_*`. For more details about application setup, check the [Git repository](https://github.com/kimlehtinen/blog-code/tree/main/flask-unit-testing).

```text
├── app.py
├── db.py
├── migrations
├── requirements.txt
├── src
│   ├── di
│   │   ├── di_container.py
│   ├── infra
│   │   ├── models
│   │   │   ├── post_model.py
│   │   └── repositories
│   │       ├── post_repository_impl.py
│   ├── modules
│   │   └── post
│   │       ├── post.py
│   │       ├── post_repository.py
│   │       ├── post_service.py
│   └── web
│       ├── post_routes.py
└── tests
    ├── modules
    │   └── post
    │       └── test_post_service.py
    └── web
        ├── conftest.py
        └── test_post_routes.py
```

The following are the Python packages used.
```text
Flask==2.2.3
pytest==7.2.2
Flask-Migrate==4.0.4
dependency-injector==4.41.0
```

This example application has one database model `PostModel` representing a posts table where posts can be stored. However, when we are unit testing we don't want our business logic to be concerned about our database implementation, and directly accessing database models. Instead, we want to define an abstract class or an interface that we later implement. This way we can have mock objects implementing the same interface. Let's define an abstract class `Post` that can be extended. Here we specify the fields, and we can also define methods that can be reused by classes extending this one, in this case we have an implementation for converting data into dict.

```python
class Post:
    id: int
    title: str
    content: str
    slug: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "slug": self.slug
        }
```

Next, we can define the database model itself that extends this abstract class. Only here are we concerned by defining database columns etc.

```python
class PostModel(db.Model, Post):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(50))
    content = db.Column(db.Text())
    slug = db.Column(db.String(50))
```

Now we can define a repository abstract class, that will abstract away the database queries. This class defines the available repository methods for retrieving data from a data source. We don't care about what that data source actually is. Notice that it only uses the abstract class for the `Post` object type returned by the method, since our repository asbtract class is not interested in database details and implementations.

```python
class PostRepository:
    def find(self, id: int) -> "Post":
        raise NotImplementedError
```

The actual database queries and database implementation specific code is place in a concrete class `PostRepositoryImpl` that implementes the method defined in the repository. In this application we use SQLAlchemy as database ORM, so that code goes here.

```python
class PostRepositoryImpl(PostRepository):
    def find(self, id: int) -> "Post":
        return db.session.query(PostModel).filter_by(id=id).first()
```

The business logic is placed in a service class called `PostService`. Here all the domain specific code and logic is placed. We inject our abstract repository into the constructor of this service. Since we are only defining the abstract repository here, we can later inject any implementation of that repository into this service, when the service is being used. When the application is running, the repository database implementation is used. However, when we want to unit test our service later, we can inject a different repository implementation during testing (mock repository), since during unit tests we aren't concerned about external processes like databases or file systems. This service has a method for finding a post, and converting that post object into a dict containing post details. In case a post isn't found, `None` is returned.

```python
class PostService:
    _post_repository: PostRepository

    def __init__(self, post_repository: PostRepository) -> None:
        self._post_repository = post_repository

    def get_single_post_details(self, id: int) -> dict:
        post: Post = self._post_repository.find(id)

        if post:
            return post.to_dict()

        return None
```

The dependency injection is setup in a DI container. In this class we create instances of our services, and inject dependencies into classes. Since `PostService` has a dependency `PostRepository`, we create an instance of that repository and inject it into the constructor of that service. Our API endpoints can make use of these services as well.

```python
class DI(containers.DeclarativeContainer):
    post_repository = providers.Factory(PostRepositoryImpl)
    post_service = providers.Factory(PostService, post_repository=post_repository)
```

This service is later used in an API endpoint. This endpoint retrieves post details by `id`. When found, post details are returned as JSON with status code 200. When post details aren't found, 404 is returned.

```python
@post_api.route("/<id>", methods=["GET"])
@inject
def get_single_post(id: str, post_service: PostService = Provide[DI.post_service]):
    post_details: dict = post_service.get_single_post_details(int(id))

    if not post_details:
        return jsonify({"message": f"Unable to find post {str(id)}"}), 404

    return jsonify(post_details), 200
```

## Testing
Now when we have the application setup, it's time to start unit testing it.

### Testing business logic
The most important part to unit test is the business logic. Most of the code you write for your application is typically business logic, where you place all the code related to a particular domain of your application. Business logic unit testing is the same no matter what kind of application you are building. The business logic is never concerned with external processes, and doesn't know what kind of external interfaces is using it. This code doesn't know that it's interacting with an SQL database, or that API endpoints are using our business logic.

Let's start with creating a test file for our `PostService` called `tests/modules/post/test_post_service.py`. In this file we will create unit tests for this service. This service only has one method, so let's create tests for that method.

The following convention is usually used when naming tests. This way we know the method we are testing, and we define a particular behaviour of our application we are interested in testing.
```python
test_<method-name>__<expected-behaviour>
```

When structuring unit tests, the test is usually devided into three different steps: **Arrange, Act and Assert**. When arranging, we are setting up our System Under Test (SUT), meaning the component that we are testing. Acting is where we are executing the component code we are testing. Finally, Assert is where we check that the results match the behaviour we are expecting.

Our service `PostService` has one method `get_single_post_details` that we want to test. First scenario we want to test is that when a post is found, post details are returned as dict. Let's call this test `test_get_single_post_details__returns_post_details_when_post_found`. Since we don't to use real database models when unit testing, we create a post object using the parent class that the SQLAlchemy model also implemented. We could also use `MagicMock` here to mock this object completely, however, in this case we can also use the parent `Post` class. The `PostRepository` dependency of our service is mocked and injected, since we don't want to use the real database implementation that would execute database queries. When mocking, we can define the return value for class methods when they are called, in this case we specify our repository to return our post object when called. When the SUT is created, the method we are testing is called, and finally we assert that it returns the correct result.

```python
def test_get_single_post_details__returns_post_details_when_post_found():
    post = Post()
    post.id = 1
    post.title = "Mock Post"
    post.content = "This is a post"
    post.slug = "mock-post"
    mock_post_repository = MagicMock()
    mock_post_repository.find.return_value = post
    sut = PostService(post_repository=mock_post_repository)

    result = sut.get_single_post_details(id=post.id)

    assert result == {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "slug": post.slug
    }
```

The second test we want to create is for the scenario when a post isn't found. Let's call this test `test_get_single_post_details__returns_None_when_no_post_found`. In this case we change our mock repository to not return any post, and test that our service returns None in this case.

```python
def test_get_single_post_details__returns_None_when_no_post_found():
    mock_post_repository = MagicMock()
    mock_post_repository.find.return_value = None
    sut = PostService(post_repository=mock_post_repository)

    result = sut.get_single_post_details(id=5)

    assert result is None
```

Now when we run the tests, we can see that both of them are working as expected.

```shell
$ python3 -m pytest tests/modules/post/test_post_service.py 
============================================== test session starts ==============================================
platform linux -- Python 3.10.6, pytest-7.2.2, pluggy-1.0.0
rootdir: /home/kim/projects/blog-code/flask-unit-testing
collected 2 items                                                                                               

tests/modules/post/test_post_service.py ..                                                                [100%]

=============================================== 2 passed in 0.04s ===============================================
```

### Testing Flask API endpoints
API endpoints should also be unit tested to make sure that they work as expected in different scenarios, and return correct HTTP responses. This is no longer business logic only code, however, we still want to make sure that our own Flask code logic works as expected.

Let's start by creating a pytest fixture for our app instance and test client in a file called `tests/web/conftest.py`. This way we automatically get a new app instance and test client for each test in isolation.

```python
@pytest.fixture
def app():
    app = create_app()

    yield app

    app.container.unwire()


@pytest.fixture
def client(app):
    return app.test_client()
```

Now we can create a test file for our `post_routes` API endpoints, called `tests/web/test_post_routes`. Now we want to test that the endpoint that fetches a single post by id work as expected.

The first scenario we want to test is that we are able to retrieve post details as JSON/dict. In addition, we want to ensure that the correct HTTP status code is returned, in this case we expect `200 OK`. In this case we need to take into account that business logic is injected into the endpoints, which is why we need to mock once again code that is interacting with external processes. The DI container is attached to the Flask app instance, which is why we override dependencies using `app.container.post_repository.override()`. In this example the repository is once again mocked just like before. The Acting step in this test is done using the test client fixture, where we can specify the endpoint URI for the endpoint we are testing. Finally, we assert that the response is what we expect.

```python
def test_get_single_post__returns_post_details_when_found(client, app):
    post = Post()
    post.id = 1
    post.title = "Mock Post"
    post.content = "This is a post"
    post.slug = "mock-post"
    mock_post_repository = MagicMock()
    mock_post_repository.find.return_value = post
    app.container.post_repository.override(mock_post_repository)

    response = client.get("/post/1")

    assert response.status_code == 200
    assert response.json == {
        "id": post.id,
        "title": post.title,
        "content": post.content,
        "slug": post.slug
    }
```

However, if you wanted to, you could also just mock the post service in case you want complete isolation between the endpoint and the dependencies it uses. Personally, I like to mock as little as possible and use as many concrete classess as possible. This is a matter of taste when it comes to unit testing. However, if mocking something is too complex in some cases, testing things in complete isolation can be a better option. Unit tests should test a single behaviour, and execute fast, just like Vladimir Khorikov states in his great book about testing called [Unit Testing Principles, Practices, and Patterns](https://www.amazon.com/Unit-Testing-Principles-Practices-Patterns/dp/1617296279?&linkCode=sl1&tag=kimlehtinen-20&linkId=600a02bed27306ae278d724df4a48e49&language=en_US&ref_=as_li_ss_tl). I highly recommend this book if you want to learn more about what to test and how.

The second scenario for this endpoint we want to test is that it is able to handle the case where no post details are found, in case a post doesn't exist. Just like before, we change our mock repository to not find any project. When asserting, we check that the endpoint returns correct HTTP status code `404` and message.

```python
def test_get_single_post__returns_not_found_when_post_details_not_found(client, app):
    mock_post_repository = MagicMock()
    mock_post_repository.find.return_value = None
    app.container.post_repository.override(mock_post_repository)

    response = client.get("/post/1")

    assert response.status_code == 404
    assert response.json == {"message": "Unable to find post 1"}
```

Instead of running test files separately, this time we can try running all of our unit tests at once. All of our tests are passing!

```shell
$ python3 -m pytest
============================ test session starts ============================
platform linux -- Python 3.10.6, pytest-7.2.2, pluggy-1.0.0
rootdir: /home/kim/projects/blog-code/flask-unit-testing
collected 4 items                                                           

tests/modules/post/test_post_service.py ..                            [ 50%]
tests/web/test_post_routes.py ..                                      [100%]

============================= 4 passed in 0.46s =============================
```

## Conclusion
That was it, now we have implemented unit tests for a Flask application. I hope you found this post useful, and got a better idea of how Flask applications can be unit tested. You might not want to implement unit tests exactly like this, however, I hope you learned something new at least. Every application is different, and people have different requirements and taste when it comes to testing, just like anything else. 

All source code can be found in my [Git repository](https://github.com/kimlehtinen/blog-code/tree/main/flask-unit-testing).
